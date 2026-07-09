import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetConnectionByPublicId = vi.fn();
const mockRecordWebhookPayloadDump = vi.fn();
const mockRecordWebhookEvent = vi.fn();
const mockFindConnectionByPhoneNumber = vi.fn();
const mockFindOrCreateContactByPhone = vi.fn();
const mockFindOrCreateConversationByWhatsappChatId = vi.fn();
const mockCreateConversationMessage = vi.fn();
const mockPersistHumanOutboundText = vi.fn();
const mockPersistHumanOutboundMedia = vi.fn();
const mockGetConversationHandlingMode = vi.fn();
const mockGetContactIsTestForConversation = vi.fn();
const mockScheduleInboundAiDebounced = vi.fn();

vi.mock("../repositories/whatsapp.js", () => ({
  getConnectionByPublicId: mockGetConnectionByPublicId,
  getConnectionById: vi.fn(),
  recordWebhookPayloadDump: mockRecordWebhookPayloadDump,
  recordWebhookEvent: mockRecordWebhookEvent,
  recordConnectionEvent: vi.fn(),
  findConnectionByPhoneNumber: mockFindConnectionByPhoneNumber,
  findOrCreateContactByPhone: mockFindOrCreateContactByPhone,
  findOrCreateConversationByWhatsappChatId: mockFindOrCreateConversationByWhatsappChatId,
  createConversationMessage: mockCreateConversationMessage,
  uploadIncomingMediaToStorage: vi.fn(),
  removeConnectionFromWebhook: vi.fn(),
  updateConnectionSyncStateFromWebhook: vi.fn(),
  updateConnectionSyncState: vi.fn(),
}));

vi.mock("../repositories/conversations.js", () => ({
  getConversationHandlingMode: mockGetConversationHandlingMode,
  signWhatsappMediaPathForInboundAi: vi.fn(),
}));

vi.mock("../repositories/contacts.js", () => ({
  getContactIsTestForConversation: mockGetContactIsTestForConversation,
}));

vi.mock("../services/conversation-persist.js", () => ({
  persistHumanOutboundTextToAgentSession: mockPersistHumanOutboundText,
  persistHumanOutboundMediaToAgentSession: mockPersistHumanOutboundMedia,
}));

vi.mock("../services/inbound-ai-debounce-schedule.js", () => ({
  scheduleInboundAiDebounced: mockScheduleInboundAiDebounced,
}));

vi.mock("../services/whatsapp-client.js", () => ({
  getQrCode: vi.fn(),
  sendTextMessageCompat: vi.fn(),
  stopConnection: vi.fn(),
  uploadAndSendMedia: vi.fn(),
}));

vi.mock("../services/whatsapp-media.js", () => ({
  downloadIncomingMedia: vi.fn(),
}));

vi.mock("../repositories/profiles.js", () => ({
  getWorkspaceOwnerEmail: vi.fn(),
}));

vi.mock("../services/email.js", () => ({
  sendWhatsappDisconnectEmail: vi.fn(),
}));

vi.mock("../agent/agent.js", () => ({
  runAgentSession: vi.fn(),
}));

const { default: app } = await import("./whatsapp.js");

const connectionId = "a1b2c3d4-e5f6-4789-a012-3456789abcde";
const agentConfigId = "b2c3d4e5-f6a7-4890-b123-456789abcdef";

function baseMessageFields(overrides: Record<string, unknown> = {}) {
  return {
    connectionId,
    messageId: "wa-msg-regression-1",
    chatId: "60123456789@s.whatsapp.net",
    sender: "60111111111@s.whatsapp.net",
    senderName: "Me",
    chatName: "Contact",
    wid: "60111111111@s.whatsapp.net",
    messageType: "textMessage",
    text: "hello",
    timestamp: 1_700_000_000,
    ...overrides,
  };
}

const outboundMirrorEvent = {
  type: "message.outbound_mirror" as const,
  ...baseMessageFields({ text: "already saved via API" }),
};

const inboundEvent = {
  type: "message.inbound" as const,
  ...baseMessageFields({
    sender: "60123456789@s.whatsapp.net",
    senderName: "Contact",
    text: "inbound hello",
  }),
};

async function postEvent(event: unknown) {
  return app.request("/events", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(event),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetConnectionByPublicId.mockResolvedValue({
    id: connectionId,
    workspace_id: "ws-1",
    display_name: "Line",
    phone_number: "60111111111",
    agent_config_id: agentConfigId,
    mode: "live",
  });
  mockRecordWebhookPayloadDump.mockResolvedValue({ ok: true });
  mockRecordWebhookEvent.mockResolvedValue({ ok: true, duplicate: false });
  mockFindConnectionByPhoneNumber.mockResolvedValue({
    id: connectionId,
    workspace_id: "ws-1",
    phone_number: "60111111111",
    agent_config_id: agentConfigId,
    mode: "live",
    status: "authorized",
    last_state_instance: null,
  });
  mockFindOrCreateContactByPhone.mockResolvedValue({ id: "contact-1" });
  mockFindOrCreateConversationByWhatsappChatId.mockResolvedValue("conv-1");
  mockPersistHumanOutboundText.mockResolvedValue({ ok: true });
  mockPersistHumanOutboundMedia.mockResolvedValue({ ok: true });
  mockGetConversationHandlingMode.mockResolvedValue("ai");
  mockGetContactIsTestForConversation.mockResolvedValue(false);
  mockCreateConversationMessage.mockResolvedValue({ ok: true, created: true });
});

describe("WhatsApp message dedupe regression", () => {
  // Regression: API outbound already wrote messages.wa_message_id → outbound_mirror must not create a second row or remirror to agent transcript.
  it("API send then outbound_mirror → created:false stops remirror", async () => {
    mockCreateConversationMessage.mockResolvedValue({ ok: true, created: false });

    const res = await postEvent(outboundMirrorEvent);

    expect(res.status).toBe(200);
    expect(mockRecordWebhookEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        dedupeKey: "message.outbound_mirror:wa-msg-regression-1",
      }),
    );
    expect(mockCreateConversationMessage).toHaveBeenCalledWith(
      "ws-1",
      "conv-1",
      "assistant",
      "already saved via API",
      expect.objectContaining({
        whatsappMessageId: "wa-msg-regression-1",
        webhookMessageId: "wa-msg-regression-1",
      }),
      "human",
      expect.objectContaining({ waMessageId: "wa-msg-regression-1" }),
    );
    expect(mockPersistHumanOutboundText).not.toHaveBeenCalled();
    expect(mockScheduleInboundAiDebounced).not.toHaveBeenCalled();
  });

  // Regression: Baileys notify/append replay hits whatsapp_webhook_events unique key → handler must exit before contact/message work.
  it("webhook_events duplicate → skips createConversationMessage", async () => {
    mockRecordWebhookEvent.mockResolvedValue({ ok: false, duplicate: true });

    const res = await postEvent(inboundEvent);

    expect(res.status).toBe(200);
    expect(mockFindOrCreateContactByPhone).not.toHaveBeenCalled();
    expect(mockCreateConversationMessage).not.toHaveBeenCalled();
    expect(mockScheduleInboundAiDebounced).not.toHaveBeenCalled();
  });

  // Regression: inbound with same Baileys id already in messages (retry after partial failure / race) → no second AI schedule.
  it("inbound created:false → does not schedule inbound AI", async () => {
    mockCreateConversationMessage.mockResolvedValue({ ok: true, created: false });

    const res = await postEvent(inboundEvent);

    expect(res.status).toBe(200);
    expect(mockCreateConversationMessage).toHaveBeenCalledWith(
      "ws-1",
      "conv-1",
      "user",
      "inbound hello",
      expect.objectContaining({
        whatsappMessageId: "wa-msg-regression-1",
        webhookMessageId: "wa-msg-regression-1",
      }),
      "human",
      expect.objectContaining({ waMessageId: "wa-msg-regression-1" }),
    );
    expect(mockScheduleInboundAiDebounced).not.toHaveBeenCalled();
  });

  // Happy path control: new inbound under Live + AI handling still schedules debounce after a fresh insert.
  it("inbound created:true under live AI → schedules inbound AI", async () => {
    mockCreateConversationMessage.mockResolvedValue({ ok: true, created: true });

    const res = await postEvent(inboundEvent);

    expect(res.status).toBe(200);
    expect(mockScheduleInboundAiDebounced).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "ws-1",
        conversationId: "conv-1",
        agentConfigId,
        whatsappConnectionId: connectionId,
      }),
    );
  });

  // Regression: phone-sent outbound (no prior API row) still mirrors into agent session after a successful insert.
  it("outbound_mirror created:true → mirrors text to agent session", async () => {
    mockCreateConversationMessage.mockResolvedValue({ ok: true, created: true });

    const res = await postEvent(outboundMirrorEvent);

    expect(res.status).toBe(200);
    expect(mockPersistHumanOutboundText).toHaveBeenCalledWith(
      expect.objectContaining({
        whatsappMessageId: "wa-msg-regression-1",
        conversationId: "conv-1",
        source: "whatsapp_outgoing_webhook",
      }),
    );
  });

  // Regression: createConversationMessage hard failure must not schedule AI (batch HTTP still returns processed).
  it("createConversationMessage ok:false → does not schedule inbound AI", async () => {
    mockCreateConversationMessage.mockResolvedValue({ ok: false, created: false });

    const res = await postEvent(inboundEvent);

    expect(res.status).toBe(200);
    expect(mockCreateConversationMessage).toHaveBeenCalled();
    expect(mockScheduleInboundAiDebounced).not.toHaveBeenCalled();
    expect(mockPersistHumanOutboundText).not.toHaveBeenCalled();
  });
});
