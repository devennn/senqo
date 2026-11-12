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

describe("BaileysSession.sendButtons", () => {
  // Happy path: an interactive message is relayed with one native-flow button
  // per template button, and the per-type params JSON carries label + value.
  it("relays an interactiveMessage with native-flow buttons", async () => {
    const relayMessage = vi.fn().mockResolvedValue("MSG-1");
    const sock = {
      ws: { isOpen: true },
      user: { id: "15551234567:1@s.whatsapp.net" },
      relayMessage,
    };
    const session = sessionWith(sock, "authorized");

    const id = await session.sendButtons({
      chatId: "15551234567",
      text: "Should I confirm?",
      buttons: [
        { type: "quick_reply", label: "Yes", value: "yes" },
        { type: "cta_url", label: "Docs", value: "https://example.com" },
      ],
    });

    expect(id).toMatch(/^[0-9A-F]{10,}$/);
    expect(relayMessage).toHaveBeenCalledTimes(1);
    const [jid, message, options] = relayMessage.mock.calls[0];
    expect(jid).toBe("15551234567@s.whatsapp.net");
    const interactive = message.interactiveMessage;
    expect(interactive.body.text).toBe("Should I confirm?");
    expect(interactive.nativeFlowMessage.buttons).toHaveLength(2);
    expect(interactive.nativeFlowMessage.buttons[0].name).toBe("quick_reply");
    expect(JSON.parse(interactive.nativeFlowMessage.buttons[0].buttonParamsJson)).toEqual({
      display_text: "Yes",
      id: "yes",
    });
    expect(JSON.parse(interactive.nativeFlowMessage.buttons[1].buttonParamsJson)).toEqual({
      display_text: "Docs",
      url: "https://example.com",
    });
    expect(options.messageId).toBe(id);
  });

  // Client rendering depends on the `biz` native-flow node. Without it the
  // recipient device silently drops the interactive message and the web client
  // shows "This message couldn't load" — keep this exact node shape.
  it("attaches the native-flow biz node required for client rendering", async () => {
    const relayMessage = vi.fn().mockResolvedValue("MSG-1");
    const sock = {
      ws: { isOpen: true },
      user: { id: "15551234567:1@s.whatsapp.net" },
      relayMessage,
    };
    const session = sessionWith(sock, "authorized");

    await session.sendButtons({
      chatId: "15551234567",
      text: "Should I confirm?",
      buttons: [{ type: "quick_reply", label: "Yes", value: "yes" }],
    });

    const [, , options] = relayMessage.mock.calls[0];
    expect(options.additionalNodes).toEqual([
      {
        tag: "biz",
        attrs: {},
        content: [
          {
            tag: "interactive",
            attrs: { type: "native_flow", v: "1" },
            content: [{ tag: "native_flow", attrs: { v: "9", name: "mixed" } }],
          },
        ],
      },
    ]);
  });

  // Error path: a session without an authorized socket user must not build or
  // relay a message — the caller surfaces a send failure instead.
  it("throws when the session is not authorized", async () => {
    const relayMessage = vi.fn();
    const unauthorizedSock = { ws: { isOpen: true }, relayMessage };
    const session = sessionWith(unauthorizedSock, "not_authorized");

    await expect(
      session.sendButtons({
        chatId: "15551234567",
        text: "Hi",
        buttons: [{ type: "quick_reply", label: "Yes", value: "yes" }],
      }),
    ).rejects.toThrow("session is not authorized");
    expect(relayMessage).not.toHaveBeenCalled();
  });
});

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
