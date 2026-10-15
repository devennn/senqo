import { describe, it, expect, vi, beforeEach } from "vitest";

const aiState = vi.hoisted(() => ({
  queue: [] as Array<{
    stepEvents: Array<Record<string, unknown>>;
    result: unknown;
    error?: Error;
  }>,
  generateCalls: [] as Array<{ messages?: unknown }>,
}));

vi.mock("ai", () => ({
  ToolLoopAgent: class {
    options: Record<string, unknown>;
    constructor(options: Record<string, unknown>) {
      this.options = options;
    }
    async generate(input?: { messages?: unknown }) {
      aiState.generateCalls.push(input ?? {});
      const item = aiState.queue.shift();
      if (!item) throw new Error("FakeToolLoopAgent has no queued result");
      if (item.error) throw item.error;
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
const mockRecordDryRunAgentFailure = vi.fn();
const mockCreateConversationMessage = vi.fn();
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
  createConversationMessage: mockCreateConversationMessage,
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
  recordDryRunAgentFailure: mockRecordDryRunAgentFailure,
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
  aiState.generateCalls.length = 0;
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
  mockRecordDryRunAgentFailure.mockResolvedValue(undefined);
  mockCreateConversationMessage.mockResolvedValue({ ok: true, created: true });
  mockSendPreparedOutboundMessages.mockImplementation(
    async (input: { messages: unknown[] }) => ({
      sent: 0,
      drafts: 0,
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

describe("runAgentSession dry-run drafts", () => {
  // Draft runs persist the reply as a draft (no send) while keeping the run
  // grounded: tools must be non-mutating and operator reasoning must persist.
  it("persists drafts and marks tools as dry run when draftRun is true", async () => {
    queueRun([], structuredOutput([{ text: "Draft reply", assetFileName: "" }]));

    const result = await runAgentSession({ ...baseInput, draftRun: true });

    expect(result?.messages).toEqual([{ text: "Draft reply", assetFileName: "" }]);
    expect(mockGetAgentTools).toHaveBeenCalledWith(
      expect.objectContaining({ dryRun: true }),
      expect.anything(),
    );
    expect(mockSendPreparedOutboundMessages).toHaveBeenCalledWith(
      expect.objectContaining({
        dryRun: false,
        draftRun: true,
        agentRunId: expect.any(String),
      }),
    );
    expect(mockMergeAiReasoning).toHaveBeenCalledWith(
      expect.objectContaining({
        agentRunId: expect.any(String),
        aiReasoning: "Drafted a weather apology",
      }),
    );
  });

  // A handoff decision during a dry run must appear as an operator-only
  // "would hand off" note and must not trigger the live handoff path.
  it("records a dry-run handoff note without live handoff when the tool is called", async () => {
    aiState.queue.push({
      stepEvents: [
        {
          stepNumber: 0,
          finishReason: "stop",
          text: "",
          toolCalls: [
            {
              toolName: "handoff_to_human",
              toolCallId: "call-1",
              input: { reason: "Customer asked for a person" },
            },
          ],
          toolResults: [
            {
              toolName: "handoff_to_human",
              toolCallId: "call-1",
              output: {
                ok: true,
                dryRun: true,
                handoff: true,
                topicEntryId: null,
                reason: "Customer asked for a person",
              },
            },
          ],
        },
      ],
      result: agentResult(structuredOutput([])),
    });

    await runAgentSession({ ...baseInput, draftRun: true });

    expect(mockCreateConversationMessage).toHaveBeenCalledWith(
      "ws-1",
      "conv-1",
      "assistant",
      "Human handoff",
      expect.objectContaining({
        thread_event: "handoff_to_human",
        handoff_tool_reason: "Customer asked for a person",
        dry_run: true,
      }),
      null,
    );
    expect(mockHandoffAfterAgentRunFailure).not.toHaveBeenCalled();
  });

  // A nested tool failure during a dry run must suppress the reply and record a
  // dry-run error event instead of switching the conversation to human handling.
  it("records a dry-run error instead of live handoff when a tool fails in draftRun", async () => {
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

    const result = await runAgentSession({ ...baseInput, draftRun: true });

    expect(mockRecordDryRunAgentFailure).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "ws-1",
        conversationId: "conv-1",
        errorMessage: "get_weather: TypeError: fetch failed",
      }),
    );
    expect(mockHandoffAfterAgentRunFailure).not.toHaveBeenCalled();
    expect(result?.messages).toEqual([]);
  });
});

describe("runAgentSession provider history rejection", () => {
  // A provider can reject replayed history whose signature-bound thinking block
  // was created under an older system prompt. The runtime must log the rejection
  // to Agent Logs, retry once without volatile history parts, and still reply.
  it("retries once without volatile parts and records a history_retry log", async () => {
    mockListAgentMessages.mockResolvedValue([
      {
        role: "assistant",
        content: [
          {
            type: "text",
            text: "previous reply",
            providerOptions: { anthropic: { signature: "stale" } },
          },
        ],
        provider_options: null,
      },
    ]);
    aiState.queue.push({
      stepEvents: [],
      result: null,
      error: new Error(
        "Invalid `signature` in `thinking` block. The block is bound to a different conversation.",
      ),
    });
    queueRun([], structuredOutput([{ text: "Hello again", assetFileName: "" }]));

    const result = await runAgentSession(baseInput);

    expect(result?.messages).toEqual([
      { text: "Hello again", assetFileName: "" },
    ]);

    const retryLogRow = mockInsertAgentMessages.mock.calls
      .flatMap(
        (call) =>
          call[0] as Array<{
            providerOptions?: Record<string, unknown>;
            content?: { error?: string };
          }>,
      )
      .find((row) => row.providerOptions?.kind === "history_retry");
    expect(retryLogRow?.content?.error).toContain(
      "bound to a different conversation",
    );

    const retryMessages = aiState.generateCalls[1]?.messages as Array<{
      role: string;
      content: unknown;
    }>;
    expect(retryMessages[0]?.content).toEqual([
      { type: "text", text: "previous reply" },
    ]);
  });

  // A retry that fails again must surface the error to the caller so the normal
  // failure handling (handoff / dry-run event) still runs.
  it("surfaces the error when the retry also fails", async () => {
    const signatureError = new Error(
      "Invalid `signature` in `thinking` block. The block is bound to a different conversation.",
    );
    aiState.queue.push({ stepEvents: [], result: null, error: signatureError });
    aiState.queue.push({ stepEvents: [], result: null, error: signatureError });

    await expect(runAgentSession(baseInput)).rejects.toThrow(
      "bound to a different conversation",
    );

    expect(aiState.generateCalls).toHaveLength(2);
  });
});
