import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockVerifyToken = vi.fn();
const mockValidateWorkspaceMembership = vi.fn();
const mockSubscribe = vi.fn();

vi.mock("../lib/auth-jwt.js", () => ({
  verifyToken: mockVerifyToken,
}));

vi.mock("../repositories/workspaces.js", () => ({
  validateWorkspaceMembership: mockValidateWorkspaceMembership,
}));

vi.mock("../lib/realtime-bus.js", () => ({
  subscribe: mockSubscribe,
}));

const { default: app, REALTIME_TICKET_TTL_MS } = await import("./realtime.js");

/** Issues a ticket through the real HTTP route so tests exercise the full handshake. */
async function issueTicket(workspaceId = "ws-1"): Promise<string> {
  const res = await app.request("/ticket", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer access-token-1" },
    body: JSON.stringify({ workspaceId }),
  });
  expect(res.status).toBe(200);
  const body = (await res.json()) as { ticket: string };
  return body.ticket;
}

beforeEach(() => {
  vi.restoreAllMocks();
  mockVerifyToken.mockReset();
  mockValidateWorkspaceMembership.mockReset();
  mockSubscribe.mockReset();

  mockVerifyToken.mockResolvedValue({ userId: "user-1" });
  mockValidateWorkspaceMembership.mockResolvedValue(true);
  mockSubscribe.mockReturnValue(() => {});
});

describe("POST /ticket", () => {
  // The ticket endpoint replaces the old flow where the access token itself rode in the stream
  // URL. Without credentials it must refuse: no ticket for anonymous callers.
  it("rejects a request without an Authorization header → 401", async () => {
    const res = await app.request("/ticket", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId: "ws-1" }),
    });

    expect(res.status).toBe(401);
  });

  // An expired or forged access token must not yield a ticket.
  it("rejects an invalid access token → 401", async () => {
    mockVerifyToken.mockResolvedValue(null);

    const res = await app.request("/ticket", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer bad-token" },
      body: JSON.stringify({ workspaceId: "ws-1" }),
    });

    expect(res.status).toBe(401);
  });

  // Non-members must not be able to subscribe to a workspace's event stream.
  it("rejects a non-member → 403", async () => {
    mockValidateWorkspaceMembership.mockResolvedValue(false);

    const res = await app.request("/ticket", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer access-token-1" },
      body: JSON.stringify({ workspaceId: "ws-other" }),
    });

    expect(res.status).toBe(403);
  });

  // A valid member request must return an opaque ticket the client can present on the stream.
  it("returns a ticket for a workspace member → 200", async () => {
    const res = await app.request("/ticket", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer access-token-1" },
      body: JSON.stringify({ workspaceId: "ws-1" }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { ticket: string };
    expect(typeof body.ticket).toBe("string");
    expect(body.ticket.length).toBeGreaterThan(20);
  });
});

describe("GET /stream", () => {
  // Missing ticket (or workspace) must be refused up front with the specific error the client
  // can distinguish from an expired ticket.
  it("rejects a request without a ticket → 400", async () => {
    const res = await app.request("/stream?workspaceId=ws-1");

    expect(res.status).toBe(400);
  });

  // Security regression (A-4): the access token used to be accepted directly in the query. It must
  // no longer work — only single-use tickets do.
  it("rejects the legacy access-token query parameter → 400", async () => {
    const res = await app.request("/stream?token=access-token-1&workspaceId=ws-1");

    expect(res.status).toBe(400);
  });

  // Happy path: a fresh ticket opens the SSE stream.
  it("opens an event stream with a valid ticket → 200", async () => {
    const ticket = await issueTicket();

    const res = await app.request(`/stream?ticket=${ticket}&workspaceId=ws-1`);

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    await res.body?.cancel();
  });

  // Tickets are single-use: replaying the same ticket (e.g. from a leaked log line) must fail.
  it("rejects a replayed ticket → 401", async () => {
    const ticket = await issueTicket();

    const first = await app.request(`/stream?ticket=${ticket}&workspaceId=ws-1`);
    await first.body?.cancel();

    const replay = await app.request(`/stream?ticket=${ticket}&workspaceId=ws-1`);
    expect(replay.status).toBe(401);
  });

  // Expired tickets must not open a stream even if never used.
  it("rejects an expired ticket → 401", async () => {
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(1_700_000_000_000);
    const ticket = await issueTicket();
    nowSpy.mockReturnValue(1_700_000_000_000 + REALTIME_TICKET_TTL_MS + 1);

    const res = await app.request(`/stream?ticket=${ticket}&workspaceId=ws-1`);

    expect(res.status).toBe(401);
    nowSpy.mockRestore();
  });

  // A ticket issued for one workspace must not grant access to another workspace's stream.
  it("rejects a ticket presented for a different workspace → 401", async () => {
    const ticket = await issueTicket("ws-1");

    const res = await app.request(`/stream?ticket=${ticket}&workspaceId=ws-2`);

    expect(res.status).toBe(401);
  });
});
