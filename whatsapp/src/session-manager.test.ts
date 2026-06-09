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

const mockStart = vi.fn();
const mockDestroy = vi.fn();
const mockStop = vi.fn();

vi.mock("../src/baileys-session.js", () => ({
  BaileysSession: vi.fn().mockImplementation((connectionId: string) => ({
    connectionId,
    start: mockStart,
    destroy: mockDestroy,
    stop: mockStop,
  })),
}));

const { getOrCreate, startSession, removeSession, get } = await import("../src/session-manager.js");

describe("session-manager", () => {
  describe("getOrCreate", () => {
    it("returns same instance for same connectionId", () => {
      const s1 = getOrCreate("conn-1");
      const s2 = getOrCreate("conn-1");
      expect(s1).toBe(s2);
    });

    it("creates new instance for new connectionId", () => {
      const s1 = getOrCreate("conn-1");
      const s2 = getOrCreate("conn-2");
      expect(s1).not.toBe(s2);
    });
  });

  describe("startSession", () => {
    it("is idempotent when called twice", async () => {
      mockStart.mockResolvedValue(undefined);
      await startSession("conn-start");
      await startSession("conn-start");
    });

    it("returns the session after starting", async () => {
      mockStart.mockResolvedValue(undefined);
      const session = await startSession("conn-start-2");
      expect(session).toBeDefined();
    });
  });

  describe("removeSession", () => {
    it("calls destroy and removes from map", async () => {
      mockDestroy.mockResolvedValue(undefined);
      getOrCreate("conn-rm");
      await removeSession("conn-rm");
      expect(mockDestroy).toHaveBeenCalled();
      expect(get("conn-rm")).toBeUndefined();
    });
  });

  describe("get", () => {
    it("returns undefined for unknown connectionId", () => {
      expect(get("nonexistent")).toBeUndefined();
    });
  });
});
