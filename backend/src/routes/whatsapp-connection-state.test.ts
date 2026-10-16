import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetConnectionByPublicId = vi.fn();
const mockGetConnectionById = vi.fn();
const mockRecordConnectionEvent = vi.fn();
const mockRecordWebhookPayloadDump = vi.fn();
const mockMarkConnectionDisconnected = vi.fn();
const mockGetWorkspaceOwnerEmail = vi.fn();
const mockSendWhatsappDisconnectEmail = vi.fn();
const mockDeleteConnectionWithTasks = vi.fn();
const mockUpdateConnectionSyncStateFromWebhook = vi.fn();

vi.mock("../repositories/whatsapp.js", () => ({
  getConnectionByPublicId: mockGetConnectionByPublicId,
  getConnectionById: mockGetConnectionById,
  recordWebhookPayloadDump: mockRecordWebhookPayloadDump,
  recordConnectionEvent: mockRecordConnectionEvent,
  markConnectionDisconnected: mockMarkConnectionDisconnected,
  recordWebhookEvent: vi.fn(),
  findConnectionByPhoneNumber: vi.fn(),
  findOrCreateContactByPhone: vi.fn(),
  findOrCreateConversationByWhatsappChatId: vi.fn(),
  createConversationMessage: vi.fn(),
  uploadIncomingMediaToStorage: vi.fn(),
  updateConnectionSyncStateFromWebhook: mockUpdateConnectionSyncStateFromWebhook,
  updateConnectionSyncState: vi.fn(),
}));

vi.mock("../repositories/conversations.js", () => ({
  getConversationHandlingMode: vi.fn(),
  signWhatsappMediaPathForInboundAi: vi.fn(),
}));

vi.mock("../repositories/contacts.js", () => ({
  getContactIsTestForConversation: vi.fn(),
}));

vi.mock("../services/conversation-persist.js", () => ({
  persistHumanOutboundTextToAgentSession: vi.fn(),
  persistHumanOutboundMediaToAgentSession: vi.fn(),
}));

vi.mock("../services/inbound-ai-debounce-schedule.js", () => ({
  scheduleInboundAiDebounced: vi.fn(),
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
  getWorkspaceOwnerEmail: mockGetWorkspaceOwnerEmail,
}));

vi.mock("../services/email.js", () => ({
  sendWhatsappDisconnectEmail: mockSendWhatsappDisconnectEmail,
}));

vi.mock("../services/connection-delete.js", () => ({
  deleteConnectionWithTasks: mockDeleteConnectionWithTasks,
}));

vi.mock("../agent/agent.js", () => ({
  runAgentSession: vi.fn(),
}));

vi.mock("../lib/env.js", () => ({
  env: { whatsappWebhookAuthorization: "test-webhook-token" },
}));

const { default: app } = await import("./whatsapp.js");

const connectionId = "a1b2c3d4-e5f6-4789-a012-3456789abcde";

function notAuthorizedEvent() {
  return {
    type: "connection.state",
    connectionId,
    state: "not_authorized",
    timestamp: 1_700_000_000,
  };
}

function authorizedEvent() {
  return {
    type: "connection.state",
    connectionId,
    state: "authorized",
    phone: "60111111111",
    timestamp: 1_700_000_000,
  };
}

async function postEvent(event: unknown, token: string | null = "test-webhook-token") {
  return app.request("/events", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token === null ? {} : { "x-webhook-token": token }),
    },
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
    agent_config_id: null,
    mode: "live",
  });
  mockGetConnectionById.mockResolvedValue({
    id: connectionId,
    workspace_id: "ws-1",
    display_name: "Line",
    phone_number: "60111111111",
    agent_config_id: null,
    mode: "live",
    status: "authorized",
    last_state_instance: "authorized",
  });
  mockRecordWebhookPayloadDump.mockResolvedValue({ ok: true });
  mockRecordConnectionEvent.mockResolvedValue({ ok: true });
  mockMarkConnectionDisconnected.mockResolvedValue({ ok: true });
  mockGetWorkspaceOwnerEmail.mockResolvedValue(null);
  mockSendWhatsappDisconnectEmail.mockResolvedValue({ ok: true });
  mockDeleteConnectionWithTasks.mockResolvedValue({ ok: true, deleted: true });
  mockUpdateConnectionSyncStateFromWebhook.mockResolvedValue({ ok: true, message: "ok" });
});

describe("connection.state webhook handling", () => {
  // Critical behavior: when WhatsApp says the device was unlinked (not_authorized), the backend must
  // mark the row not authorized and attempt the row cleanup so a stale "Authorized" card cannot linger.
  it("not_authorized → marks the connection disconnected and runs cleanup", async () => {
    const res = await postEvent(notAuthorizedEvent());

    expect(res.status).toBe(200);
    expect(mockMarkConnectionDisconnected).toHaveBeenCalledWith("ws-1", connectionId);
    expect(mockRecordConnectionEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "ws-1",
        connectionIdSnapshot: connectionId,
        eventType: "connection_disconnected",
        source: "webhook",
      }),
    );
    expect(mockDeleteConnectionWithTasks).toHaveBeenCalledWith("ws-1", connectionId);
  });

  // Error path: if the cleanup delete fails (e.g. another constraint rejects it), the webhook must still
  // acknowledge the event — the row is already marked not authorized, so the card stays truthful.
  it("not_authorized with failing cleanup → still marks disconnected and returns 200", async () => {
    mockDeleteConnectionWithTasks.mockResolvedValue({ ok: false, deleted: false });

    const res = await postEvent(notAuthorizedEvent());

    expect(res.status).toBe(200);
    expect(mockMarkConnectionDisconnected).toHaveBeenCalledWith("ws-1", connectionId);
    expect(mockDeleteConnectionWithTasks).toHaveBeenCalledWith("ws-1", connectionId);
  });

  // Regression guard: a healthy authorized event must not trigger the disconnect marking or the cleanup.
  it("authorized → updates sync state and never marks disconnected", async () => {
    const res = await postEvent(authorizedEvent());

    expect(res.status).toBe(200);
    expect(mockUpdateConnectionSyncStateFromWebhook).toHaveBeenCalledWith(
      connectionId,
      expect.objectContaining({ status: "authorized", stateInstance: "authorized" }),
    );
    expect(mockMarkConnectionDisconnected).not.toHaveBeenCalled();
    expect(mockDeleteConnectionWithTasks).not.toHaveBeenCalled();
  });
});

describe("events webhook authorization", () => {
  // Security regression (S-01): the event webhook previously accepted unauthenticated requests, so a
  // forged inbound message could be injected with a single curl. A missing x-webhook-token must be
  // rejected before any connection lookup or event processing happens.
  it("rejects a request without x-webhook-token → 401 and no processing", async () => {
    const res = await postEvent(notAuthorizedEvent(), null);

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthorized" });
    expect(mockGetConnectionByPublicId).not.toHaveBeenCalled();
  });

  // Wrong credentials must be rejected too: a same-length, non-matching token exercises the
  // constant-time compare (a length mismatch short-circuits before it) and must not process events.
  it("rejects a request with a wrong x-webhook-token → 401 and no processing", async () => {
    const res = await postEvent(notAuthorizedEvent(), "test-webhook-tokeX");

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthorized" });
    expect(mockGetConnectionByPublicId).not.toHaveBeenCalled();
  });
});
