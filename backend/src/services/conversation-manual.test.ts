import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSendTextMessage = vi.fn();
const mockPersistHumanOutboundText = vi.fn();
const mockCreateConversationMessage = vi.fn();
const mockGetManualWhatsappSendTarget = vi.fn();

vi.mock("../services/whatsapp-client.js", () => ({
  sendTextMessageCompat: mockSendTextMessage,
  uploadAndSendMedia: vi.fn(),
}));

vi.mock("../services/conversation-persist.js", () => ({
  persistHumanOutboundTextToAgentSession: mockPersistHumanOutboundText,
  persistHumanOutboundMediaToAgentSession: vi.fn(),
}));

vi.mock("../repositories/whatsapp.js", () => ({
  createConversationMessage: mockCreateConversationMessage,
  getManualWhatsappSendTarget: mockGetManualWhatsappSendTarget,
}));

const { sendManualConversationMessage } = await import(
  "../services/conversation-manual.js"
);

const mockTarget = {
  chatId: "test-chat-id",
  connection: { id: "conn-1" },
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("sendManualConversationMessage", () => {
  it("persists message, mirrors to agent transcript, and returns ok on success", async () => {
    mockGetManualWhatsappSendTarget.mockResolvedValue(mockTarget);
    mockSendTextMessage.mockResolvedValue({ messageId: "wa-msg-1" });
    mockCreateConversationMessage.mockResolvedValue({ ok: true });
    mockPersistHumanOutboundText.mockResolvedValue({ ok: true });

    const result = await sendManualConversationMessage({
      workspaceId: "ws-1",
      conversationId: "conv-1",
      message: "Hello from manual",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.idMessage).toBe("wa-msg-1");
    }
    expect(mockGetManualWhatsappSendTarget).toHaveBeenCalledWith(
      "ws-1",
      "conv-1",
    );
    expect(mockSendTextMessage).toHaveBeenCalledWith("conn-1", {
      chatId: "test-chat-id",
      text: "Hello from manual",
    });
    expect(mockCreateConversationMessage).toHaveBeenCalled();
    expect(mockPersistHumanOutboundText).toHaveBeenCalled();
  });

  it("returns error when getManualWhatsappSendTarget returns null", async () => {
    mockGetManualWhatsappSendTarget.mockResolvedValue(null);

    const result = await sendManualConversationMessage({
      workspaceId: "ws-1",
      conversationId: "conv-1",
      message: "Hello",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("not connected");
    }
    expect(mockSendTextMessage).not.toHaveBeenCalled();
  });

  it("returns error when message is empty", async () => {
    const result = await sendManualConversationMessage({
      workspaceId: "ws-1",
      conversationId: "conv-1",
      message: "   ",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("Message is required.");
    }
    expect(mockGetManualWhatsappSendTarget).not.toHaveBeenCalled();
  });

  it("returns error when createConversationMessage fails", async () => {
    mockGetManualWhatsappSendTarget.mockResolvedValue(mockTarget);
    mockSendTextMessage.mockResolvedValue({ messageId: "wa-msg-1" });
    mockCreateConversationMessage.mockResolvedValue({ ok: false });

    const result = await sendManualConversationMessage({
      workspaceId: "ws-1",
      conversationId: "conv-1",
      message: "Hello",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("failed to save");
    }
  });

  it("trims whitespace from message before sending", async () => {
    mockGetManualWhatsappSendTarget.mockResolvedValue(mockTarget);
    mockSendTextMessage.mockResolvedValue({ messageId: "wa-msg-2" });
    mockCreateConversationMessage.mockResolvedValue({ ok: true });
    mockPersistHumanOutboundText.mockResolvedValue({ ok: true });

    const result = await sendManualConversationMessage({
      workspaceId: "ws-1",
      conversationId: "conv-1",
      message: "  Hello trimmed  ",
    });

    expect(result.ok).toBe(true);
    expect(mockCreateConversationMessage).toHaveBeenCalledWith(
      "ws-1",
      "conv-1",
      "assistant",
      "Hello trimmed",
      expect.any(Object),
      "human",
    );
  });
});
