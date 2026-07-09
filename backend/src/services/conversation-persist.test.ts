import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFindAgentSession = vi.fn();
const mockCreateAgentSession = vi.fn();
const mockTouchAgentSession = vi.fn();
const mockInsertAgentMessages = vi.fn();

vi.mock("../repositories/agent-sessions.js", () => ({
  findAgentSession: mockFindAgentSession,
  createAgentSession: mockCreateAgentSession,
  touchAgentSession: mockTouchAgentSession,
}));

vi.mock("../repositories/agent-messages.js", () => ({
  insertAgentMessages: mockInsertAgentMessages,
}));

const { persistHumanOutboundTextToAgentSession } = await import(
  "./conversation-persist.js"
);

beforeEach(() => {
  vi.clearAllMocks();
  mockFindAgentSession.mockResolvedValue({
    id: "conv-1",
    workspace_id: "ws-1",
    status: "active",
    metadata: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  mockInsertAgentMessages.mockResolvedValue(true);
  mockTouchAgentSession.mockResolvedValue(undefined);
});

describe("persistHumanOutboundTextToAgentSession wa_message_id regression", () => {
  // Regression: outbound mirror must pass Baileys id into insertAgentMessages with ignoreDuplicates so agent_messages unique index can drop remirrors.
  it("passes waMessageId and ignoreDuplicates to insertAgentMessages", async () => {
    const result = await persistHumanOutboundTextToAgentSession({
      workspaceId: "ws-1",
      conversationId: "conv-1",
      message: "hello from phone",
      chatId: "60123456789@s.whatsapp.net",
      whatsappMessageId: "wa-agent-1",
      whatsappConnectionId: "conn-1",
      source: "whatsapp_outgoing_webhook",
    });

    expect(result).toEqual({ ok: true });
    expect(mockInsertAgentMessages).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          workspaceId: "ws-1",
          sessionId: "conv-1",
          role: "assistant",
          waMessageId: "wa-agent-1",
          providerOptions: expect.objectContaining({
            whatsappMessageId: "wa-agent-1",
          }),
        }),
      ],
      { ignoreDuplicates: true },
    );
    expect(mockTouchAgentSession).toHaveBeenCalledWith("ws-1", "conv-1");
  });

  // Regression: second mirror with the same WA id still returns ok when insertAgentMessages reports success after ON CONFLICT DO NOTHING.
  it("treats duplicate agent_messages insert as success", async () => {
    mockInsertAgentMessages.mockResolvedValue(true);

    const first = await persistHumanOutboundTextToAgentSession({
      workspaceId: "ws-1",
      conversationId: "conv-1",
      message: "hello",
      chatId: "chat-1",
      whatsappMessageId: "wa-dup",
      whatsappConnectionId: "conn-1",
      source: "manual_conversation_send",
    });
    const second = await persistHumanOutboundTextToAgentSession({
      workspaceId: "ws-1",
      conversationId: "conv-1",
      message: "hello",
      chatId: "chat-1",
      whatsappMessageId: "wa-dup",
      whatsappConnectionId: "conn-1",
      source: "whatsapp_outgoing_webhook",
    });

    expect(first).toEqual({ ok: true });
    expect(second).toEqual({ ok: true });
    expect(mockInsertAgentMessages).toHaveBeenCalledTimes(2);
    expect(mockInsertAgentMessages).toHaveBeenNthCalledWith(
      2,
      [expect.objectContaining({ waMessageId: "wa-dup" })],
      { ignoreDuplicates: true },
    );
  });

  // Insert failure must still surface as ok:false so callers can log mirror errors.
  it("returns ok false when insertAgentMessages fails", async () => {
    mockInsertAgentMessages.mockResolvedValue(false);

    const result = await persistHumanOutboundTextToAgentSession({
      workspaceId: "ws-1",
      conversationId: "conv-1",
      message: "hello",
      chatId: "chat-1",
      whatsappMessageId: "wa-fail",
      whatsappConnectionId: "conn-1",
      source: "manual_conversation_send",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("Failed to insert agent message");
    }
  });
});
