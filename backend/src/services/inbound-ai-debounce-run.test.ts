import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRunAgentSession = vi.fn();
const mockGetConversationHandlingMode = vi.fn();
const mockListConversationMessagesBareForAi = vi.fn();
const mockGetContactIsTestForConversation = vi.fn();
const mockGetWhatsappConnectionModeForInboundAi = vi.fn();
const mockClearInboundAiDebouncePending = vi.fn();
const mockUpdateConversationHandlingMode = vi.fn();
const mockCreateConversationMessage = vi.fn();
const mockScheduleHandoffNotify = vi.fn();
const mockInsertAgentMessages = vi.fn();

vi.mock("../agent/agent.js", () => ({
  runAgentSession: mockRunAgentSession,
}));

vi.mock("../repositories/conversations.js", () => ({
  getConversationHandlingMode: mockGetConversationHandlingMode,
  listConversationMessagesBareForAi: mockListConversationMessagesBareForAi,
  updateConversationHandlingMode: mockUpdateConversationHandlingMode,
}));

vi.mock("../repositories/contacts.js", () => ({
  getContactIsTestForConversation: mockGetContactIsTestForConversation,
}));

vi.mock("../repositories/inbound-ai-debounce-pending.js", () => ({
  clearInboundAiDebouncePending: mockClearInboundAiDebouncePending,
}));

vi.mock("../repositories/whatsapp.js", () => ({
  createConversationMessage: mockCreateConversationMessage,
  getWhatsappConnectionModeForInboundAi: mockGetWhatsappConnectionModeForInboundAi,
}));

vi.mock("../repositories/agent-messages.js", () => ({
  insertAgentMessages: mockInsertAgentMessages,
}));

vi.mock("../lib/inbound-media-resolve.js", () => ({
  resolveInboundMediaSigned: vi.fn(),
}));

vi.mock("./handoff-notify.js", () => ({
  scheduleHandoffNotify: mockScheduleHandoffNotify,
  notifyHandoffHuman: vi.fn(),
}));

const { executeInboundDebouncedAiRun } = await import("./inbound-ai-debounce-run.js");

const baseInput = {
  workspaceId: "ws-1",
  conversationId: "conv-1",
  agentConfigId: "agent-1",
  whatsappConnectionId: "conn-testing",
};

function mockTrailingUserMessage(content = "hello") {
  mockListConversationMessagesBareForAi.mockResolvedValue([
    {
      role: "user",
      content,
      created_at: "2026-06-11T10:00:00.000Z",
    },
  ]);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetConversationHandlingMode.mockResolvedValue("ai");
  mockGetContactIsTestForConversation.mockResolvedValue(true);
  mockGetWhatsappConnectionModeForInboundAi.mockResolvedValue("testing");
  mockRunAgentSession.mockResolvedValue({
    sessionId: "conv-1",
    messages: [{ text: "Hi there" }],
    handoff_enabled: false,
  });
  mockClearInboundAiDebouncePending.mockResolvedValue(true);
  mockUpdateConversationHandlingMode.mockResolvedValue({ ok: true });
  mockCreateConversationMessage.mockResolvedValue({ ok: true, created: true });
  mockInsertAgentMessages.mockResolvedValue(true);
});

describe("executeInboundDebouncedAiRun", () => {
  // Debounce job carries the testing line that received the inbound → mode lookup uses that line and AI inference runs, needed to verify the multi-connection fix end-to-end in the debounced path.
  it("runs AI when the debounce job scopes to a testing line and test contact", async () => {
    mockGetWhatsappConnectionModeForInboundAi.mockResolvedValue("testing");
    mockTrailingUserMessage();

    const result = await executeInboundDebouncedAiRun(baseInput);

    expect(result.ok).toBe(true);
    expect(mockGetWhatsappConnectionModeForInboundAi).toHaveBeenCalledWith(
      "ws-1",
      "conv-1",
      "agent-1",
      "conn-testing",
    );
    expect(mockRunAgentSession).toHaveBeenCalledWith(
      expect.objectContaining({
        skipInference: false,
        skipInferenceReason: undefined,
      }),
    );
  });

  // Resolved mode is inactive (stale thread line) → inbound is saved but inference is skipped with the inactive reason, matching the operator-visible failure mode.
  it("skips inference when resolved connection mode is inactive", async () => {
    mockGetWhatsappConnectionModeForInboundAi.mockResolvedValue("inactive");
    mockTrailingUserMessage();

    const result = await executeInboundDebouncedAiRun({
      ...baseInput,
      whatsappConnectionId: undefined,
    });

    expect(result.ok).toBe(true);
    expect(mockRunAgentSession).toHaveBeenCalledWith(
      expect.objectContaining({
        skipInference: true,
        skipInferenceReason: "connection mode is inactive",
      }),
    );
  });

  // A thrown agent run must not leave the chat in AI mode where the customer could
  // get an "unable to access" reply; it switches to human and records the operator-only error.
  it("hands off and records the error when the agent run throws", async () => {
    mockTrailingUserMessage();
    mockRunAgentSession.mockRejectedValue(new Error("OpenRouter request failed"));

    const result = await executeInboundDebouncedAiRun(baseInput);

    expect(result.ok).toBe(false);
    expect(mockUpdateConversationHandlingMode).toHaveBeenCalledWith(
      "ws-1",
      "conv-1",
      "human",
    );
    expect(mockCreateConversationMessage).toHaveBeenCalledWith(
      "ws-1",
      "conv-1",
      "assistant",
      "AI could not reply",
      {
        thread_event: "agent_error",
      },
      null,
    );
    expect(mockScheduleHandoffNotify).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "ws-1",
        conversationId: "conv-1",
        agentConfigId: "agent-1",
      }),
    );
  });

  // A null agent result is also an internal failure: same handoff and error event,
  // so operators see it and no reply is attempted.
  it("hands off and records the error when the agent run returns null", async () => {
    mockTrailingUserMessage();
    mockRunAgentSession.mockResolvedValue(null);

    const result = await executeInboundDebouncedAiRun(baseInput);

    expect(result.ok).toBe(false);
    expect(mockUpdateConversationHandlingMode).toHaveBeenCalledWith(
      "ws-1",
      "conv-1",
      "human",
    );
    expect(mockCreateConversationMessage).toHaveBeenCalledWith(
      "ws-1",
      "conv-1",
      "assistant",
      "AI could not reply",
      {
        thread_event: "agent_error",
      },
      null,
    );
  });

  // Dry-run mode must run inference with draftRun so replies are persisted as
  // drafts for review, never sent to the customer.
  it("passes draftRun when the connection mode is dry_run", async () => {
    mockGetWhatsappConnectionModeForInboundAi.mockResolvedValue("dry_run");
    mockTrailingUserMessage();

    const result = await executeInboundDebouncedAiRun(baseInput);

    expect(result.ok).toBe(true);
    expect(mockRunAgentSession).toHaveBeenCalledWith(
      expect.objectContaining({
        draftRun: true,
        dryRun: false,
        skipInference: false,
      }),
    );
  });

  // A failed dry run must leave an operator-only dry-run error event without
  // switching the chat to human or alerting teammates.
  it("records a dry-run error without handoff when the run throws in dry_run mode", async () => {
    mockGetWhatsappConnectionModeForInboundAi.mockResolvedValue("dry_run");
    mockTrailingUserMessage();
    mockRunAgentSession.mockRejectedValue(new Error("OpenRouter request failed"));

    const result = await executeInboundDebouncedAiRun(baseInput);

    expect(result.ok).toBe(false);
    expect(mockUpdateConversationHandlingMode).not.toHaveBeenCalled();
    expect(mockCreateConversationMessage).toHaveBeenCalledWith(
      "ws-1",
      "conv-1",
      "assistant",
      "AI could not reply",
      {
        thread_event: "agent_error",
        dry_run: true,
      },
      null,
    );
    expect(mockScheduleHandoffNotify).not.toHaveBeenCalled();
  });

  // A voice note the AI cannot process during a dry run must annotate a
  // would-hand-off note without switching live handling or notifying teammates.
  it("records a dry-run handoff note for unsupported media without switching handling", async () => {
    mockGetWhatsappConnectionModeForInboundAi.mockResolvedValue("dry_run");
    mockListConversationMessagesBareForAi.mockResolvedValue([
      {
        role: "user",
        content: "[audioMessage]",
        created_at: "2026-06-11T10:00:00.000Z",
        metadata: { messageType: "audioMessage" },
      },
    ]);

    const result = await executeInboundDebouncedAiRun(baseInput);

    expect(result.ok).toBe(true);
    expect(mockUpdateConversationHandlingMode).not.toHaveBeenCalled();
    expect(mockScheduleHandoffNotify).not.toHaveBeenCalled();
    expect(mockCreateConversationMessage).toHaveBeenCalledWith(
      "ws-1",
      "conv-1",
      "assistant",
      "Human handoff",
      expect.objectContaining({
        thread_event: "handoff_to_human",
        dry_run: true,
      }),
      null,
    );
  });
});
