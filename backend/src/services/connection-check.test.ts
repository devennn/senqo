import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockGetConnectionLiveState = vi.fn();
const mockRestartConnection = vi.fn();
const mockGetConnectionById = vi.fn();
const mockMarkConnectionDisconnected = vi.fn();
const mockRecordConnectionEvent = vi.fn();
const mockGetAgentConfigById = vi.fn();

vi.mock("./whatsapp-client.js", () => ({
  getConnectionLiveState: mockGetConnectionLiveState,
  restartConnection: mockRestartConnection,
}));

vi.mock("../repositories/whatsapp.js", () => ({
  getConnectionById: mockGetConnectionById,
  markConnectionDisconnected: mockMarkConnectionDisconnected,
  recordConnectionEvent: mockRecordConnectionEvent,
}));

vi.mock("../repositories/agent.js", () => ({
  getAgentConfigById: mockGetAgentConfigById,
}));

const { checkConnection, getConnectionDeletePreflight } = await import("./connection-check.js");

const live = { reachable: true, status: "authorized", socketOpen: true };
const authorizedSocketClosed = { reachable: true, status: "authorized", socketOpen: false };
const pendingQr = { reachable: true, status: "pending_qr", socketOpen: false };
const notAuthorized = { reachable: true, status: "not_authorized", socketOpen: false };
const unreachable = { reachable: false };

beforeEach(() => {
  vi.clearAllMocks();
  mockRestartConnection.mockResolvedValue(undefined);
  mockMarkConnectionDisconnected.mockResolvedValue({ ok: true });
  mockRecordConnectionEvent.mockResolvedValue({ ok: true });
  mockGetAgentConfigById.mockResolvedValue({ profile_name: "Support" });
  mockGetConnectionById.mockResolvedValue({
    id: "conn-1",
    workspace_id: "ws-1",
    display_name: "Line",
    phone_number: "60111111111",
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("checkConnection", () => {
  // Happy path: service reports an open authorized socket — report connected without touching the DB.
  it("returns connected when the socket is open and authorized", async () => {
    mockGetConnectionLiveState.mockResolvedValue(live);

    const status = await checkConnection("ws-1", "conn-1");

    expect(status).toBe("connected");
    expect(mockRestartConnection).not.toHaveBeenCalled();
    expect(mockMarkConnectionDisconnected).not.toHaveBeenCalled();
  });

  // A session waiting for a QR scan is reported as pending_qr so the UI can point at Reconnect QR.
  it("reports pending_qr when the session is waiting for a scan", async () => {
    mockGetConnectionLiveState.mockResolvedValue(pendingQr);

    const status = await checkConnection("ws-1", "conn-1");

    expect(status).toBe("pending_qr");
    expect(mockRestartConnection).not.toHaveBeenCalled();
  });

  // Confirmed logout: mark the row not authorized, record the activity event, and report disconnected.
  it("marks the row disconnected and records an event when the session is logged out", async () => {
    mockGetConnectionLiveState.mockResolvedValue(notAuthorized);

    const status = await checkConnection("ws-1", "conn-1");

    expect(status).toBe("disconnected");
    expect(mockMarkConnectionDisconnected).toHaveBeenCalledWith("ws-1", "conn-1");
    expect(mockRecordConnectionEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "ws-1",
        connectionIdSnapshot: "conn-1",
        eventType: "connection_disconnected",
        source: "status_refresh",
      }),
    );
  });

  // Recovery path: stale authorized state with no open socket → reopen the socket; if it comes back, report connected.
  it("reopens a stale socket and reports connected when it recovers", async () => {
    vi.useFakeTimers();
    mockGetConnectionLiveState
      .mockResolvedValueOnce(authorizedSocketClosed)
      .mockResolvedValueOnce(live);

    const pending = checkConnection("ws-1", "conn-1");
    await vi.advanceTimersByTimeAsync(1000);
    const status = await pending;

    expect(status).toBe("connected");
    expect(mockRestartConnection).toHaveBeenCalledWith("conn-1");
    expect(mockMarkConnectionDisconnected).not.toHaveBeenCalled();
  });

  // Error path: socket never reopens → after the recovery window the row is marked disconnected.
  it("marks disconnected when the socket never reopens", async () => {
    vi.useFakeTimers();
    mockGetConnectionLiveState.mockResolvedValue(authorizedSocketClosed);

    const pending = checkConnection("ws-1", "conn-1");
    await vi.advanceTimersByTimeAsync(8000);
    const status = await pending;

    expect(status).toBe("disconnected");
    expect(mockMarkConnectionDisconnected).toHaveBeenCalledWith("ws-1", "conn-1");
  });

  // Error path: the WhatsApp service being unreachable must not be confused with a logged-out session
  // (a down service should not flip the card to Not Authorized).
  it("returns unavailable when the service cannot be reached", async () => {
    mockGetConnectionLiveState.mockResolvedValue(unreachable);

    const status = await checkConnection("ws-1", "conn-1");

    expect(status).toBe("unavailable");
    expect(mockRestartConnection).not.toHaveBeenCalled();
    expect(mockMarkConnectionDisconnected).not.toHaveBeenCalled();
  });
});

describe("getConnectionDeletePreflight", () => {
  const attachedConnection = {
    id: "conn-1",
    workspace_id: "ws-1",
    display_name: "Line",
    phone_number: "60111111111",
    agent_config_id: "agent-1",
  };

  // Missing rows return null so the route can answer 404 without touching the WhatsApp service.
  it("returns null when the connection does not exist", async () => {
    mockGetConnectionById.mockResolvedValue(null);

    const preflight = await getConnectionDeletePreflight("ws-1", "conn-1");

    expect(preflight).toBeNull();
    expect(mockGetConnectionLiveState).not.toHaveBeenCalled();
  });

  // The core block: a live line attached to an agent is not deletable and names that agent.
  it("blocks a live attached connection and returns the agent", async () => {
    mockGetConnectionById.mockResolvedValue(attachedConnection);
    mockGetConnectionLiveState.mockResolvedValue(live);

    const preflight = await getConnectionDeletePreflight("ws-1", "conn-1");

    expect(preflight).toEqual({
      status: "connected",
      agent: { id: "agent-1", name: "Support" },
      deletable: false,
      blockedReason: "connection_attached_to_agent",
    });
  });

  // An unattached live line deletes normally — no agent lookup happens at all.
  it("allows a live unattached connection without an agent lookup", async () => {
    mockGetConnectionById.mockResolvedValue({ ...attachedConnection, agent_config_id: null });
    mockGetConnectionLiveState.mockResolvedValue(live);

    const preflight = await getConnectionDeletePreflight("ws-1", "conn-1");

    expect(preflight).toMatchObject({ status: "connected", agent: null, deletable: true, blockedReason: null });
    expect(mockGetAgentConfigById).not.toHaveBeenCalled();
  });

  // An attached but dead line is not disrupting the agent, so deleting stays allowed (agent still shown).
  it("allows an attached connection that is no longer live", async () => {
    mockGetConnectionById.mockResolvedValue(attachedConnection);
    mockGetConnectionLiveState.mockResolvedValue(notAuthorized);

    const preflight = await getConnectionDeletePreflight("ws-1", "conn-1");

    expect(preflight).toMatchObject({
      status: "disconnected",
      agent: { id: "agent-1", name: "Support" },
      deletable: true,
      blockedReason: null,
    });
  });

  // A down WhatsApp service must not block deletion (the line is not replying anyway) — status says unavailable.
  it("allows deletion when the WhatsApp service is unreachable", async () => {
    mockGetConnectionById.mockResolvedValue(attachedConnection);
    mockGetConnectionLiveState.mockResolvedValue(unreachable);

    const preflight = await getConnectionDeletePreflight("ws-1", "conn-1");

    expect(preflight).toMatchObject({ status: "unavailable", deletable: true, blockedReason: null });
  });
});
