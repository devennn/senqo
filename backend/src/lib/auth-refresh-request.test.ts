import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";

const mockDb = {
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  execute: vi.fn(),
};

vi.mock("../db/index.js", () => ({
  db: mockDb,
}));

async function getAuthRefreshRequest() {
  return await import("../lib/auth-refresh-request.js");
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("auth-refresh-request", () => {
  describe("readRefreshTokenFromRequest", () => {
    // Parses the "senqo_refresh" cookie from the request header to extract the token value.
    // Expected: returns the token value from the cookie string.
    it("extracts refresh token from cookie header", async () => {
      const { readRefreshTokenFromRequest } = await getAuthRefreshRequest();
      const c = {
        req: {
          header: vi.fn().mockReturnValue("senqo_refresh=test-token-123; other=val"),
          json: vi.fn().mockRejectedValue(new Error("no body")),
        },
      } as unknown as Parameters<typeof readRefreshTokenFromRequest>[0];
      const result = await readRefreshTokenFromRequest(c);
      expect(result).toBe("test-token-123");
    });

    // When no cookie is present, falls back to reading refreshToken from the JSON body.
    // Expected: returns the token from the JSON body field.
    it("extracts refresh token from JSON body when no cookie", async () => {
      const { readRefreshTokenFromRequest } = await getAuthRefreshRequest();
      const c = {
        req: {
          header: vi.fn().mockReturnValue(""),
          json: vi.fn().mockResolvedValue({ refreshToken: "body-token-456" }),
        },
      } as unknown as Parameters<typeof readRefreshTokenFromRequest>[0];
      const result = await readRefreshTokenFromRequest(c);
      expect(result).toBe("body-token-456");
    });

    // When neither cookie nor body has a token, returns null without error.
    // Expected: returns null.
    it("returns null when no token in cookie or body", async () => {
      const { readRefreshTokenFromRequest } = await getAuthRefreshRequest();
      const c = {
        req: {
          header: vi.fn().mockReturnValue(""),
          json: vi.fn().mockResolvedValue(null),
        },
      } as unknown as Parameters<typeof readRefreshTokenFromRequest>[0];
      const result = await readRefreshTokenFromRequest(c);
      expect(result).toBeNull();
    });
  });
});
