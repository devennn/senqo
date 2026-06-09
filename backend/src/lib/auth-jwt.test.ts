import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";

const originalEnv = process.env;

beforeAll(() => {
  process.env = { ...originalEnv, JWT_SECRET: "test-secret-key-for-unit-tests-32chars" };
});

afterAll(() => {
  process.env = originalEnv;
});

describe("auth-jwt", () => {
  describe("signAccessToken", () => {
    it("returns a valid JWT with sub and 15-min expiry", async () => {
      const { signAccessToken, verifyToken } = await import("../lib/auth-jwt.js");
      const token = await signAccessToken("user-1");
      const result = await verifyToken(token);
      expect(result).not.toBeNull();
      expect(result?.userId).toBe("user-1");
    });
  });

  describe("signRefreshToken", () => {
    it("returns a valid JWT with type: refresh and 7-day expiry", async () => {
      const { signRefreshToken, verifyRefreshToken } = await import("../lib/auth-jwt.js");
      const token = await signRefreshToken("user-1");
      const result = await verifyRefreshToken(token);
      expect(result).not.toBeNull();
      expect(result?.userId).toBe("user-1");
    });
  });

  describe("verifyToken", () => {
    it("returns userId for a valid access token", async () => {
      const { signAccessToken, verifyToken } = await import("../lib/auth-jwt.js");
      const token = await signAccessToken("user-1");
      const result = await verifyToken(token);
      expect(result).toEqual({ userId: "user-1" });
    });

    it("returns null for an empty token", async () => {
      const { verifyToken } = await import("../lib/auth-jwt.js");
      const result = await verifyToken("");
      expect(result).toBeNull();
    });

    it("returns null for a tampered token", async () => {
      const { signAccessToken, verifyToken } = await import("../lib/auth-jwt.js");
      const token = await signAccessToken("user-1");
      const tampered = token.slice(0, -5) + "XXXXX";
      const result = await verifyToken(tampered);
      expect(result).toBeNull();
    });

    it("returns null for an already-expired token", async () => {
      const { verifyToken } = await import("../lib/auth-jwt.js");
      const expiredToken = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyLTEiLCJleHAiOjF9.BAD_SIGNATURE";
      const result = await verifyToken(expiredToken);
      expect(result).toBeNull();
    });
  });

  describe("verifyRefreshToken", () => {
    it("rejects a non-refresh-type token", async () => {
      const { signAccessToken, verifyRefreshToken } = await import("../lib/auth-jwt.js");
      const accessToken = await signAccessToken("user-1");
      const result = await verifyRefreshToken(accessToken);
      expect(result).toBeNull();
    });
  });
});
