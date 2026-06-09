import { describe, expect, it, vi } from "vitest";

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

const { shouldIngestBaileysMessage } = await import("./message-ingest.js");

describe("shouldIngestBaileysMessage", () => {
  it("returns false for channel messages", () => {
    expect(
      shouldIngestBaileysMessage({
        key: { remoteJid: "120363123456789012@newsletter", id: "msg-1" },
        message: { conversation: "hello" },
      }),
    ).toBe(false);
  });

  it("returns true for direct user messages", () => {
    expect(
      shouldIngestBaileysMessage({
        key: { remoteJid: "123456789@s.whatsapp.net", id: "msg-1" },
        message: { conversation: "hello" },
      }),
    ).toBe(true);
  });
});
