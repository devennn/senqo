import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockGetConnectionLiveState = vi.fn();
const mockRestartConnection = vi.fn();
const mockGetConnectionById = vi.fn();
const mockMarkConnectionDisconnected = vi.fn();
const mockRecordConnectionEvent = vi.fn();

vi.mock("./whatsapp-client.js", () => ({
  getConnectionLiveState: mockGetConnectionLiveState,
  restartConnection: mockRestartConnection,
}));

vi.mock("../repositories/whatsapp.js", () => ({
  getConnectionById: mockGetConnectionById,
  markConnectionDisconnected: mockMarkConnectionDisconnected,
  recordConnectionEvent: mockRecordConnectionEvent,
}));

const { checkConnection } = await import("./connection-check.js");

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
