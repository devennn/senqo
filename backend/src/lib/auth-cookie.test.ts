import { describe, it, expect, afterEach } from "vitest";

afterEach(() => {
  delete process.env.AUTH_COOKIE_SECURE;
  delete process.env.APP_URL;
});

describe("auth-cookie", () => {
  describe("isAuthCookieSecure", () => {
    it("returns true for https URL when env override not set", async () => {
      const { isAuthCookieSecure } = await import("../lib/auth-cookie.js");
      process.env.APP_URL = "https://app.example.com";
      expect(isAuthCookieSecure()).toBe(true);
    });

    it("returns false for http URL when env override not set", async () => {
      const { isAuthCookieSecure } = await import("../lib/auth-cookie.js");
      process.env.APP_URL = "http://localhost:3000";
      expect(isAuthCookieSecure()).toBe(false);
    });

    it("returns true when AUTH_COOKIE_SECURE override is true", async () => {
      const { isAuthCookieSecure } = await import("../lib/auth-cookie.js");
      process.env.AUTH_COOKIE_SECURE = "true";
      process.env.APP_URL = "http://localhost:3000";
      expect(isAuthCookieSecure()).toBe(true);
    });

    it("returns false when AUTH_COOKIE_SECURE override is false", async () => {
      const { isAuthCookieSecure } = await import("../lib/auth-cookie.js");
      process.env.AUTH_COOKIE_SECURE = "false";
      process.env.APP_URL = "https://app.example.com";
      expect(isAuthCookieSecure()).toBe(false);
    });

    it("returns false when APP_URL is empty and no override", async () => {
      const { isAuthCookieSecure } = await import("../lib/auth-cookie.js");
      process.env.APP_URL = "";
      expect(isAuthCookieSecure()).toBe(false);
    });
  });

  describe("refreshCookieOptions", () => {
    it("returns httpOnly:true cookie options with 7-day maxAge", async () => {
      process.env.APP_URL = "https://app.example.com";
      const { refreshCookieOptions } = await import("../lib/auth-cookie.js");
      const opts = refreshCookieOptions();
      expect(opts.httpOnly).toBe(true);
      expect(opts.secure).toBe(true);
      expect(opts.sameSite).toBe("lax");
      expect(opts.path).toBe("/api/auth");
      expect(opts.maxAge).toBe(60 * 60 * 24 * 7);
    });
  });
});
