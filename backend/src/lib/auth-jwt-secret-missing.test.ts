import { describe, it, expect, afterEach } from "vitest";

afterEach(() => {
  delete process.env.JWT_SECRET;
});

describe("auth-jwt edge cases", () => {
  it("throws when JWT_SECRET is not set", async () => {
    const { signAccessToken } = await import("../lib/auth-jwt.js");
    await expect(signAccessToken("user-1")).rejects.toThrow("JWT_SECRET environment variable is not set");
  });
});
