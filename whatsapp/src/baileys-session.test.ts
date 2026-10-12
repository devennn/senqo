import { describe, it, expect, vi } from "vitest";

vi.mock("./env.js", () => ({
  env: {
    sessionsDir: "/tmp/whatsapp-test-sessions",
    backendWebhookUrl: "http://backend/api/whatsapp/events",
    webhookToken: "test-token",
  },
}));

vi.mock("./logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), debug: vi.fn(), error: vi.fn() },
  baileysLogger: { level: "silent" },
}));

const { BaileysSession } = await import("./baileys-session.js");

type FakeSock = { ws: { isOpen: boolean } };

function sessionWith(sock: FakeSock, status: string) {
  const session = new BaileysSession("conn-test");
  Object.assign(session, { sock, status });
  return session;
}

describe("BaileysSession.getStatus", () => {
  // A session that never started must report a closed socket — the connection checker relies on this
  // to avoid treating a stale "authorized" label as a live connection.
  it("reports socketOpen:false before any socket exists", () => {
    const session = new BaileysSession("conn-test");

    expect(session.getStatus()).toEqual({
      status: "not_authorized",
      phone: undefined,
      socketOpen: false,
    });
  });

  // An open socket must surface as socketOpen:true so checks can confirm a truly live line.
  it("reports socketOpen:true while the socket is open", () => {
    const session = sessionWith({ ws: { isOpen: true } }, "authorized");

    expect(session.getStatus()).toEqual({
      status: "authorized",
      phone: undefined,
      socketOpen: true,
    });
  });

  // A closed socket on a stale authorized session must report socketOpen:false — the check service
  // then attempts a socket restart instead of trusting the status label.
  it("reports socketOpen:false when the socket is closed", () => {
    const session = sessionWith({ ws: { isOpen: false } }, "authorized");

    expect(session.getStatus().socketOpen).toBe(false);
  });
});
