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

const { persistHumanOutboundTextToAgentSession, persistHumanOutboundMediaToAgentSession } =
  await import("./conversation-persist.js");

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

describe("persistHumanOutboundMediaToAgentSession vision mirrors", () => {
  // Operator images stored by the webhook carry their storage path; the mirror
  // must persist the stable reference so replay can re-sign a fresh URL instead
  // of reusing the expiring one that used to be embedded in the transcript.
  it("persists a media_ref part when a storage copy exists", async () => {
    const result = await persistHumanOutboundMediaToAgentSession({
      workspaceId: "ws-1",
      conversationId: "conv-1",
      chatId: "60123456789@s.whatsapp.net",
      whatsappMessageId: "wa-media-1",
      whatsappConnectionId: "conn-1",
      fileName: "IMG.bin",
      mimeType: "image/jpeg",
      mediaKind: "image",
      caption: "",
      storagePath: "ws-1/chat-1/msg-1/IMG.bin",
      sourceUrl: "https://signed.example/expiring-url",
      source: "whatsapp_outgoing_webhook",
    });

    expect(result).toEqual({ ok: true });
    expect(mockInsertAgentMessages).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          workspaceId: "ws-1",
          sessionId: "conv-1",
          role: "assistant",
          content: [
            { type: "text", text: "[Operator sent via WhatsApp]\nIMG.bin" },
            {
              type: "media_ref",
              media: { bucket: "whatsapp-media", path: "ws-1/chat-1/msg-1/IMG.bin" },
            },
          ],
        }),
      ],
      { ignoreDuplicates: true },
    );
  });

  // Callers without a stored copy (scheduled-task attachments) still need the
  // vision part; the URL they pass is persisted as before.
  it("falls back to an image_url part when no storage path exists", async () => {
    await persistHumanOutboundMediaToAgentSession({
      workspaceId: "ws-1",
      conversationId: "conv-1",
      chatId: "chat-1",
      whatsappMessageId: "wa-media-2",
      whatsappConnectionId: "conn-1",
      fileName: "chart.png",
      mimeType: "image/png",
      mediaKind: "image",
      caption: "",
      sourceUrl: "https://app.example.com/api/tasks/file.png",
      source: "task_execute_manual",
    });

    expect(mockInsertAgentMessages).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          content: [
            { type: "text", text: "[Operator sent via WhatsApp]\nchart.png" },
            {
              type: "image_url",
              image_url: { url: "https://app.example.com/api/tasks/file.png" },
            },
          ],
        }),
      ],
      { ignoreDuplicates: true },
    );
  });

  // Non-image attachments keep the text-only fallback (no vision part).
  it("persists a text description for non-image media", async () => {
    await persistHumanOutboundMediaToAgentSession({
      workspaceId: "ws-1",
      conversationId: "conv-1",
      chatId: "chat-1",
      whatsappMessageId: "wa-media-3",
      whatsappConnectionId: "conn-1",
      fileName: "report.pdf",
      mimeType: "application/pdf",
      mediaKind: "file",
      caption: "Here you go",
      storagePath: "ws-1/chat-1/msg-3/report.pdf",
      sourceUrl: "",
      source: "manual_conversation_media_send",
    });

    expect(mockInsertAgentMessages).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          content: [
            {
              type: "text",
              text: "[Operator sent via WhatsApp]\nHere you go\nreport.pdf",
            },
          ],
        }),
      ],
      { ignoreDuplicates: true },
    );
  });
});
