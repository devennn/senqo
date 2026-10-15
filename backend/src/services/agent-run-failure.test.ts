import { describe, it, expect, vi, beforeEach } from "vitest";

const mockUpdateConversationHandlingMode = vi.fn();
const mockCreateConversationMessage = vi.fn();
const mockScheduleHandoffNotify = vi.fn();
const mockListErrorAlertSubscriberUserIds = vi.fn();
const mockInsertAgentMessages = vi.fn();

vi.mock("../repositories/conversations.js", () => ({
  updateConversationHandlingMode: mockUpdateConversationHandlingMode,
}));

vi.mock("../repositories/error-alert-subscribers.js", () => ({
  listErrorAlertSubscriberUserIds: mockListErrorAlertSubscriberUserIds,
}));

vi.mock("../repositories/whatsapp.js", () => ({
  createConversationMessage: mockCreateConversationMessage,
}));

vi.mock("../repositories/agent-messages.js", () => ({
  insertAgentMessages: mockInsertAgentMessages,
}));

vi.mock("./handoff-notify.js", () => ({
  scheduleHandoffNotify: mockScheduleHandoffNotify,
}));

const { handoffAfterAgentRunFailure, recordDryRunAgentFailure } = await import(
  "./agent-run-failure.js"
);

const baseInput = {
  workspaceId: "ws-1",
  conversationId: "conv-1",
  agentConfigId: "agent-1",
  errorMessage: "OpenRouter request failed",
};

function storedErrorLog(): {
  content: { error: string };
  providerOptions: Record<string, unknown>;
} {
  const rows = mockInsertAgentMessages.mock.calls[0][0] as Array<{
    content: { error: string };
    providerOptions: Record<string, unknown>;
  }>;
  return rows[0];
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUpdateConversationHandlingMode.mockResolvedValue({ ok: true });
  mockCreateConversationMessage.mockResolvedValue({ ok: true, created: true });
  mockListErrorAlertSubscriberUserIds.mockResolvedValue(["user-owner"]);
  mockInsertAgentMessages.mockResolvedValue(true);
});

describe("handoffAfterAgentRunFailure", () => {
  // A failed agent run must switch the chat to human handling, alert only the
  // opted-in team members, and split visibility: the thread keeps a short event
  // while the verbose provider error goes to Agent Logs.
  it("switches to human handling, records the error, and alerts opted-in members", async () => {
    await handoffAfterAgentRunFailure(baseInput);

    expect(mockUpdateConversationHandlingMode).toHaveBeenCalledWith(
      "ws-1",
      "conv-1",
      "human",
    );
    expect(mockInsertAgentMessages).toHaveBeenCalledWith([
      {
        workspaceId: "ws-1",
        sessionId: "conv-1",
        role: "assistant",
        content: {
          type: "agent_error",
          error: "OpenRouter request failed",
          dry_run: false,
          agent_config_id: "agent-1",
        },
        providerOptions: { source: "agent_run_log", kind: "agent_error" },
      },
    ]);
    expect(mockCreateConversationMessage).toHaveBeenCalledWith(
      "ws-1",
      "conv-1",
      "assistant",
      "AI could not reply",
      { thread_event: "agent_error" },
      null,
    );
    expect(mockScheduleHandoffNotify).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "ws-1",
        conversationId: "conv-1",
        agentConfigId: "agent-1",
        recipientUserIds: ["user-owner"],
      }),
    );
  });

  // Default setup: nobody opted in, so no alert is sent but the handoff still happens.
  it("still hands off with an empty recipient list when nobody opted in", async () => {
    mockListErrorAlertSubscriberUserIds.mockResolvedValue([]);

    await handoffAfterAgentRunFailure(baseInput);

    expect(mockUpdateConversationHandlingMode).toHaveBeenCalledWith(
      "ws-1",
      "conv-1",
      "human",
    );
    expect(mockScheduleHandoffNotify).toHaveBeenCalledWith(
      expect.objectContaining({ recipientUserIds: [] }),
    );
  });

  // If the conversation mode cannot be switched the handoff did not happen, so
  // the caller must not get a misleading error event or alert — but the error
  // must still be inspectable in Agent Logs.
  it("still records the Agent Logs error when the handling mode switch fails", async () => {
    mockUpdateConversationHandlingMode.mockResolvedValue({ ok: false });

    await handoffAfterAgentRunFailure(baseInput);

    expect(storedErrorLog().content.error).toBe("OpenRouter request failed");
    expect(mockCreateConversationMessage).not.toHaveBeenCalled();
    expect(mockScheduleHandoffNotify).not.toHaveBeenCalled();
  });

  // Raw provider errors can be huge; the stored log keeps a bounded message so
  // the transcript and realtime payload stay reasonable.
  it("truncates an oversized error message before storing it", async () => {
    await handoffAfterAgentRunFailure({
      ...baseInput,
      errorMessage: "x".repeat(2500),
    });

    const stored = storedErrorLog().content.error;
    expect(stored.length).toBe(2001);
    expect(stored.endsWith("\u2026")).toBe(true);
  });
});

describe("recordDryRunAgentFailure", () => {
  // A failed dry run must keep the chat untouched and never alert teammates;
  // operators see a short dry-run event and the verbose error in Agent Logs.
  it("records the Agent Logs error and a dry-run event without touching handling", async () => {
    await recordDryRunAgentFailure({
      workspaceId: "ws-1",
      conversationId: "conv-1",
      errorMessage: "Azure signature error",
    });

    expect(mockInsertAgentMessages).toHaveBeenCalledWith([
      {
        workspaceId: "ws-1",
        sessionId: "conv-1",
        role: "assistant",
        content: {
          type: "agent_error",
          error: "Azure signature error",
          dry_run: true,
        },
        providerOptions: { source: "agent_run_log", kind: "agent_error" },
      },
    ]);
    expect(mockCreateConversationMessage).toHaveBeenCalledWith(
      "ws-1",
      "conv-1",
      "assistant",
      "AI could not reply",
      { thread_event: "agent_error", dry_run: true },
      null,
    );
    expect(mockUpdateConversationHandlingMode).not.toHaveBeenCalled();
    expect(mockScheduleHandoffNotify).not.toHaveBeenCalled();
  });

  // A blank provider error must not produce an empty log row; the fallback text
  // keeps Agent Logs readable.
  it("falls back to a generic message when the provider error is blank", async () => {
    await recordDryRunAgentFailure({
      workspaceId: "ws-1",
      conversationId: "conv-1",
      errorMessage: "   ",
    });

    expect(storedErrorLog().content.error).toBe("Agent run failed");
  });
});
