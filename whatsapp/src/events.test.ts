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

const { buildMessageEvent } = await import("./events.js");
type BuildContext = import("./events.js").BuildContext;

const CHAT_ID = "15551234567@s.whatsapp.net";

function ctx(): BuildContext {
  return {
    connectionId: "conn-1",
    // Phone-number JIDs resolve without touching the socket, so a bare object is enough.
    sock: {} as BuildContext["sock"],
    selfJid: "15550000000:1@s.whatsapp.net",
    getGroupMetadata: async () => null,
    getContactName: () => undefined,
  };
}

function message(messageContent: Record<string, unknown>) {
  return {
    key: { remoteJid: CHAT_ID, fromMe: false, id: "MSG-1" },
    message: messageContent,
    messageTimestamp: 1_800_000_000,
    pushName: "Customer",
  } as never;
}

describe("buildMessageEvent — interactive button taps", () => {
  // Quick-reply taps arrive as native flow responses; the chosen display text must
  // become the inbound message text so the agent and thread can see the choice.
  it("maps a native flow response to interactiveResponseMessage with the display text", async () => {
    const event = await buildMessageEvent(
      ctx(),
      message({
        interactiveResponseMessage: {
          nativeFlowResponseMessage: {
            name: "quick_reply",
            paramsJson: JSON.stringify({ id: "yes", display_text: "Yes" }),
            version: 3,
          },
        },
      }),
    );

    expect(event?.type).toBe("message.inbound");
    if (event?.type !== "message.inbound") throw new Error("expected inbound event");
    expect(event.messageType).toBe("interactiveResponseMessage");
    expect(event.text).toBe("Yes");
    expect(event.interactiveResponse?.id).toBe("yes");
    expect(event.interactiveResponse?.name).toBe("quick_reply");
  });

  // Other button kinds (URL/call) send no params JSON; the button name and body
  // text are the only signal, so the event must still carry something readable.
  it("falls back to body text when params JSON is absent", async () => {
    const event = await buildMessageEvent(
      ctx(),
      message({
        interactiveResponseMessage: {
          body: { text: "Open link" },
          nativeFlowResponseMessage: { name: "cta_url" },
        },
      }),
    );

    if (event?.type !== "message.inbound") throw new Error("expected inbound event");
    expect(event.messageType).toBe("interactiveResponseMessage");
    expect(event.text).toBe("Open link");
    expect(event.interactiveResponse?.id).toBeUndefined();
  });

  // Legacy taps (buttons sent before native flow) must not be dropped either.
  it("maps a legacy buttons response to the same backend type", async () => {
    const event = await buildMessageEvent(
      ctx(),
      message({
        buttonsResponseMessage: {
          selectedButtonId: "no",
          selectedDisplayText: "No thanks",
        },
      }),
    );

    if (event?.type !== "message.inbound") throw new Error("expected inbound event");
    expect(event.messageType).toBe("interactiveResponseMessage");
    expect(event.text).toBe("No thanks");
    expect(event.interactiveResponse?.id).toBe("no");
    expect(event.interactiveResponse?.name).toBe("buttons");
  });

  // Unrelated protocol messages stay un-ingested so the webhook does not see noise.
  it("returns null for message types that are not ingested", async () => {
    const event = await buildMessageEvent(ctx(), message({ protocolMessage: { type: 0 } }));
    expect(event).toBeNull();
  });
});
