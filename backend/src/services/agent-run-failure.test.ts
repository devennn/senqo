import { describe, it, expect, vi, beforeEach } from "vitest";

const mockUpdateConversationHandlingMode = vi.fn();
const mockCreateConversationMessage = vi.fn();
const mockScheduleHandoffNotify = vi.fn();
const mockListErrorAlertSubscriberUserIds = vi.fn();

vi.mock("../repositories/conversations.js", () => ({
  updateConversationHandlingMode: mockUpdateConversationHandlingMode,
}));

vi.mock("../repositories/error-alert-subscribers.js", () => ({
  listErrorAlertSubscriberUserIds: mockListErrorAlertSubscriberUserIds,
}));

vi.mock("../repositories/whatsapp.js", () => ({
  createConversationMessage: mockCreateConversationMessage,
}));

vi.mock("./handoff-notify.js", () => ({
  scheduleHandoffNotify: mockScheduleHandoffNotify,
}));

const { handoffAfterAgentRunFailure } = await import("./agent-run-failure.js");

const baseInput = {
  workspaceId: "ws-1",
  conversationId: "conv-1",
  agentConfigId: "agent-1",
  errorMessage: "OpenRouter request failed",
};

beforeEach(() => {
  vi.clearAllMocks();
  mockUpdateConversationHandlingMode.mockResolvedValue({ ok: true });
  mockCreateConversationMessage.mockResolvedValue({ ok: true, created: true });
  mockListErrorAlertSubscriberUserIds.mockResolvedValue(["user-owner"]);
});

describe("handoffAfterAgentRunFailure", () => {
  // A failed agent run must switch the chat to human handling, leave an
  // operator-only error event, and alert only the opted-in team members.
  it("switches to human handling, records the error, and alerts opted-in members", async () => {
    await handoffAfterAgentRunFailure(baseInput);

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
        agent_error_message: "OpenRouter request failed",
      },
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
  // the caller must not get a misleading error event or alert.
  it("writes nothing when the handling mode switch fails", async () => {
    mockUpdateConversationHandlingMode.mockResolvedValue({ ok: false });

    await handoffAfterAgentRunFailure(baseInput);

    expect(mockCreateConversationMessage).not.toHaveBeenCalled();
    expect(mockScheduleHandoffNotify).not.toHaveBeenCalled();
  });

  // Raw provider errors can be huge; the stored operator event keeps a bounded
  // message so the thread and realtime payload stay reasonable.
  it("truncates an oversized error message before storing it", async () => {
    await handoffAfterAgentRunFailure({
      ...baseInput,
      errorMessage: "x".repeat(2500),
    });

    const stored = mockCreateConversationMessage.mock.calls[0][4] as {
      agent_error_message: string;
    };
    expect(stored.agent_error_message.length).toBe(2001);
    expect(stored.agent_error_message.endsWith("\u2026")).toBe(true);
  });
});
