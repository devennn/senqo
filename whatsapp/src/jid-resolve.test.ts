import { describe, it, expect, vi } from "vitest";

process.env.WHATSAPP_SERVICE_API_KEY = "test-api-key";
process.env.WHATSAPP_WEBHOOK_AUTHORIZATION = "test-webhook-token";

vi.mock("../src/logger.js", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: vi.fn().mockReturnValue({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    }),
  },
  baileysLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
  logRawEventToCategory: vi.fn(),
}));

describe("jid resolution", () => {
  // When a messageKey provides remoteJidAlt, the LID must resolve to the phone-number JID from remoteJidAlt.
  it("resolves LID to phone-number JID when remoteJidAlt is available", async () => {
    const { learnFromMessageKey, resolveToPn, clearConnectionLidState } = await import("../src/jid.js");
    clearConnectionLidState("conn-jid");
    learnFromMessageKey("conn-jid", {
      remoteJid: "111@lid",
      remoteJidAlt: "1234567890@s.whatsapp.net",
    });
    const result = resolveToPn("conn-jid", "111@lid");
    expect(result.jid).toBe("1234567890@s.whatsapp.net");
  });

  // When a contact roster entry provides lid and phoneNumber, the LID must resolve via the contact's phone number.
  it("resolves LID via contact roster lookup", async () => {
    const { learnFromContact, resolveToPn, clearConnectionLidState } = await import("../src/jid.js");
    clearConnectionLidState("conn-contact");
    learnFromContact("conn-contact", {
      id: "222@lid",
      lid: "222@lid",
      phoneNumber: "9876543210@s.whatsapp.net",
      name: "Test Contact",
    });
    const result = resolveToPn("conn-contact", "222@lid");
    expect(result.jid).toBe("9876543210@s.whatsapp.net");
  });

  // When no mapping exists for a LID, the function must fall back to returning the LID itself as the JID.
  it("falls back to LID-only chatId when no mapping exists", async () => {
    const { resolveToPn, clearConnectionLidState } = await import("../src/jid.js");
    clearConnectionLidState("conn-nomap");
    const result = resolveToPn("conn-nomap", "999999@lid");
    expect(result.jid).toBe("999999@lid");
  });
});
