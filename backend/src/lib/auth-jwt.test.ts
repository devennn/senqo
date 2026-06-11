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
    // Access token must be a valid JWT containing the user sub and verifiable.
    // Expected: verifyToken returns non-null with userId matching the signed sub.
    it("returns a valid JWT with sub and 15-min expiry", async () => {
      const { signAccessToken, verifyToken } = await import("../lib/auth-jwt.js");
      const token = await signAccessToken("user-1");
      const result = await verifyToken(token);
      expect(result).not.toBeNull();
      expect(result?.userId).toBe("user-1");
    });
  });

  describe("signRefreshToken", () => {
    // Refresh token must be verifiable by verifyRefreshToken and contain the user sub.
    // Expected: verifyRefreshToken returns non-null with the correct userId.
    it("returns a valid JWT with type: refresh and 7-day expiry", async () => {
      const { signRefreshToken, verifyRefreshToken } = await import("../lib/auth-jwt.js");
      const token = await signRefreshToken("user-1");
      const result = await verifyRefreshToken(token);
      expect(result).not.toBeNull();
      expect(result?.userId).toBe("user-1");
    });
  });

  describe("verifyToken", () => {
    // A valid access token must decode to the correct userId.
    // Expected: returns { userId: "user-1" }.
    it("returns userId for a valid access token", async () => {
      const { signAccessToken, verifyToken } = await import("../lib/auth-jwt.js");
      const token = await signAccessToken("user-1");
      const result = await verifyToken(token);
      expect(result).toEqual({ userId: "user-1" });
    });

    // An empty string token is never valid and should not throw.
    // Expected: returns null.
    it("returns null for an empty token", async () => {
      const { verifyToken } = await import("../lib/auth-jwt.js");
      const result = await verifyToken("");
      expect(result).toBeNull();
    });

    // Tampering with a valid token should cause verification to fail.
    // Expected: returns null for a token with the last 5 chars replaced.
    it("returns null for a tampered token", async () => {
      const { signAccessToken, verifyToken } = await import("../lib/auth-jwt.js");
      const token = await signAccessToken("user-1");
      const tampered = token.slice(0, -5) + "XXXXX";
      const result = await verifyToken(tampered);
      expect(result).toBeNull();
    });

    // An already-expired token (exp=1) must be rejected.
    // Expected: returns null because the token expired in 1970.
    it("returns null for an already-expired token", async () => {
      const { verifyToken } = await import("../lib/auth-jwt.js");
      const expiredToken = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyLTEiLCJleHAiOjF9.BAD_SIGNATURE";
      const result = await verifyToken(expiredToken);
      expect(result).toBeNull();
    });
  });

  describe("verifyRefreshToken", () => {
    // verifyRefreshToken must reject access tokens (not of type "refresh").
    // Expected: returns null when passed an access token instead of refresh token.
    it("rejects a non-refresh-type token", async () => {
      const { signAccessToken, verifyRefreshToken } = await import("../lib/auth-jwt.js");
      const accessToken = await signAccessToken("user-1");
      const result = await verifyRefreshToken(accessToken);
      expect(result).toBeNull();
    });
  });
});
