import { describe, it, expect, vi, beforeEach } from "vitest";

const aiState = vi.hoisted(() => ({
  queue: [] as Array<{ stepEvents: Array<Record<string, unknown>>; result: unknown }>,
}));

vi.mock("ai", () => ({
  ToolLoopAgent: class {
    options: Record<string, unknown>;
    constructor(options: Record<string, unknown>) {
      this.options = options;
    }
    async generate() {
      const item = aiState.queue.shift();
      if (!item) throw new Error("FakeToolLoopAgent has no queued result");
      const onStepFinish = this.options.onStepFinish as
        | ((event: Record<string, unknown>) => void)
        | undefined;
      for (const event of item.stepEvents) {
        onStepFinish?.(event);
      }
      return item.result;
    }
  },
  Output: { object: (config: unknown) => config },
  stepCountIs: () => 1,
}));

const mockResolveSessionId = vi.fn();
const mockBuildAgentInstructions = vi.fn();
const mockGetAgentTools = vi.fn();
const mockGetAgentConfigById = vi.fn();
const mockMarkAgentConfigFirstUsed = vi.fn();
const mockGetWorkspaceTimeZone = vi.fn();
const mockInsertAgentMessages = vi.fn();
const mockListAgentMessages = vi.fn();
const mockTouchAgentSession = vi.fn();
const mockMergeAiReasoning = vi.fn();
const mockHandoffAfterAgentRunFailure = vi.fn();
const mockSendPreparedOutboundMessages = vi.fn();
const mockGetChatLLM = vi.fn();

vi.mock("./session.js", () => ({ resolveSessionId: mockResolveSessionId }));
vi.mock("./skills-catalog.js", () => ({
  buildAgentInstructionsWithCatalog: mockBuildAgentInstructions,
}));
vi.mock("./tools/index.js", () => ({ getAgentTools: mockGetAgentTools }));
vi.mock("./llm.js", () => ({ getChatLLM: mockGetChatLLM }));
vi.mock("../repositories/agent.js", () => ({
  getAgentConfigById: mockGetAgentConfigById,
  markAgentConfigFirstUsed: mockMarkAgentConfigFirstUsed,
}));
vi.mock("../repositories/workspaces.js", () => ({
  getWorkspaceTimeZone: mockGetWorkspaceTimeZone,
}));
vi.mock("../repositories/agent-messages.js", () => ({
  insertAgentMessages: mockInsertAgentMessages,
  listAgentMessages: mockListAgentMessages,
}));
vi.mock("../repositories/agent-sessions.js", () => ({
  touchAgentSession: mockTouchAgentSession,
}));
vi.mock("../repositories/whatsapp.js", () => ({
  mergeAiReasoningOntoAgentRunMessages: mockMergeAiReasoning,
}));
vi.mock("./reply-sources.js", () => ({
  needsKnowledgeSourcesRegen: () => false,
  resolveAgentReplySources: () => [],
  resolveHandoffTopicLabel: () => null,
}));
vi.mock("../services/agent-outbound-messages.js", () => ({
  prepareOutboundMessages: (messages: unknown[]) => messages,
  sendPreparedOutboundMessages: mockSendPreparedOutboundMessages,
}));
vi.mock("../services/agent-run-failure.js", () => ({
  handoffAfterAgentRunFailure: mockHandoffAfterAgentRunFailure,
}));

const { runAgentSession } = await import("./agent.js");

const baseInput = {
  workspaceId: "ws-1",
  sessionId: "conv-1",
  agentConfigId: "agent-1",
  message: "What is the weather?",
  dryRun: false,
};

function structuredOutput(messages: Array<{ text: string; assetFileName: string }>) {
  return {
    messages,
    reasoning_for_operators: "Drafted a weather apology",
    knowledge_used: false,
    sources: [],
    handoff_enabled: false,
  };
}

function agentResult(output: ReturnType<typeof structuredOutput>) {
  return { output, response: { messages: [] }, steps: [] };
}

function queueRun(
  stepToolResults: Array<
    Array<{ toolName: string; toolCallId: string; output: unknown }>
  >,
  output: ReturnType<typeof structuredOutput>,
) {
  aiState.queue.push({
    stepEvents: stepToolResults.map((toolResults, stepNumber) => ({
      stepNumber,
      finishReason: "stop",
      text: "",
      toolCalls: [],
      toolResults,
    })),
    result: agentResult(output),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  aiState.queue.length = 0;
  mockResolveSessionId.mockResolvedValue("conv-1");
  mockBuildAgentInstructions.mockResolvedValue({
    instructions: "system",
    sourceCatalog: {},
  });
  mockGetAgentTools.mockResolvedValue({});
  mockGetAgentConfigById.mockResolvedValue({ tools: ["get_weather"] });
  mockGetWorkspaceTimeZone.mockResolvedValue("UTC");
  mockInsertAgentMessages.mockResolvedValue([{ id: "m1" }]);
  mockListAgentMessages.mockResolvedValue([]);
  mockTouchAgentSession.mockResolvedValue(true);
  mockMergeAiReasoning.mockResolvedValue({ ok: true });
  mockHandoffAfterAgentRunFailure.mockResolvedValue(undefined);
  mockSendPreparedOutboundMessages.mockImplementation(
    async (input: { messages: unknown[] }) => ({
      sent: 0,
      messages: input.messages,
      deliveries: [],
    }),
  );
  mockGetChatLLM.mockReturnValue({});
});

describe("runAgentSession custom tool failures", () => {
  // Nested callTool failure inside execute_code must suppress the draft reply.
  it("suppresses the customer reply and hands off when a nested code tool is still failing", async () => {
    queueRun(
      [
        [
          {
            toolName: "execute_code",
            toolCallId: "call-1",
            output: {
              ok: true,
              result: { note: "failed" },
              toolResults: [
                {
                  toolKey: "get_weather",
                  output: { ok: false, error: "TypeError: fetch failed" },
                },
              ],
            },
          },
        ],
      ],
      structuredOutput([
        { text: "I'm unable to fetch the weather right now.", assetFileName: "" },
      ]),
    );

    const result = await runAgentSession(baseInput);

    expect(result?.handoff_enabled).toBe(true);
    expect(result?.handoffCalled).toBe(true);
    expect(result?.messages).toEqual([]);
    expect(mockHandoffAfterAgentRunFailure).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "ws-1",
        conversationId: "conv-1",
        agentConfigId: "agent-1",
        errorMessage: "get_weather: TypeError: fetch failed",
      }),
    );
    expect(mockSendPreparedOutboundMessages).toHaveBeenCalledWith(
      expect.objectContaining({ messages: [] }),
    );
  });

  // A later execute_code that succeeds nested callTool clears the failure.
  it("sends the reply when a nested code tool succeeds on a later step", async () => {
    queueRun(
      [
        [
          {
            toolName: "execute_code",
            toolCallId: "call-1",
            output: {
              ok: true,
              result: {},
              toolResults: [
                {
                  toolKey: "get_weather",
                  output: { ok: false, error: "TypeError: fetch failed" },
                },
              ],
            },
          },
        ],
        [
          {
            toolName: "execute_code",
            toolCallId: "call-2",
            output: {
              ok: true,
              result: { temperature: 31 },
              toolResults: [
                {
                  toolKey: "get_weather",
                  output: { ok: true, temperature: 31 },
                },
              ],
            },
          },
        ],
      ],
      structuredOutput([{ text: "It is 31C in Kuala Lumpur.", assetFileName: "" }]),
    );

    const result = await runAgentSession(baseInput);

    expect(mockHandoffAfterAgentRunFailure).not.toHaveBeenCalled();
    expect(result?.messages).toEqual([
      { text: "It is 31C in Kuala Lumpur.", assetFileName: "" },
    ]);
  });

  // Dry runs (evals, previews) must never change conversation handling.
  it("does not hand off on a nested code tool failure during a dry run", async () => {
    queueRun(
      [
        [
          {
            toolName: "execute_code",
            toolCallId: "call-1",
            output: {
              ok: false,
              error: "Compile failed",
              toolResults: [],
            },
          },
        ],
      ],
      structuredOutput([{ text: "Draft after failure", assetFileName: "" }]),
    );

    const result = await runAgentSession({ ...baseInput, dryRun: true });

    expect(mockHandoffAfterAgentRunFailure).not.toHaveBeenCalled();
    expect(result?.messages).toEqual([
      { text: "Draft after failure", assetFileName: "" },
    ]);
  });
});
