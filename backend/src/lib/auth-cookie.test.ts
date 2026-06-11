import { describe, it, expect, afterEach } from "vitest";

afterEach(() => {
  delete process.env.AUTH_COOKIE_SECURE;
  delete process.env.APP_URL;
});

describe("auth-cookie", () => {
  describe("isAuthCookieSecure", () => {
    // An https APP_URL without override should yield a secure cookie flag.
    // Expected: returns true for https URL when no AUTH_COOKIE_SECURE override.
    it("returns true for https URL when env override not set", async () => {
      const { isAuthCookieSecure } = await import("../lib/auth-cookie.js");
      process.env.APP_URL = "https://app.example.com";
      expect(isAuthCookieSecure()).toBe(true);
    });

    // An http APP_URL without override should not use secure cookies.
    // Expected: returns false because the URL scheme is not https.
    it("returns false for http URL when env override not set", async () => {
      const { isAuthCookieSecure } = await import("../lib/auth-cookie.js");
      process.env.APP_URL = "http://localhost:3000";
      expect(isAuthCookieSecure()).toBe(false);
    });

    // Override flag "true" forces secure cookies even when the URL is http.
    // Expected: returns true regardless of the URL being http.
    it("returns true when AUTH_COOKIE_SECURE override is true", async () => {
      const { isAuthCookieSecure } = await import("../lib/auth-cookie.js");
      process.env.AUTH_COOKIE_SECURE = "true";
      process.env.APP_URL = "http://localhost:3000";
      expect(isAuthCookieSecure()).toBe(true);
    });

    // Override flag "false" disables secure cookies even when the URL is https.
    // Expected: returns false regardless of the URL being https.
    it("returns false when AUTH_COOKIE_SECURE override is false", async () => {
      const { isAuthCookieSecure } = await import("../lib/auth-cookie.js");
      process.env.AUTH_COOKIE_SECURE = "false";
      process.env.APP_URL = "https://app.example.com";
      expect(isAuthCookieSecure()).toBe(false);
    });

    // An empty APP_URL with no override should default to non-secure.
    // Expected: returns false as a safe default.
    it("returns false when APP_URL is empty and no override", async () => {
      const { isAuthCookieSecure } = await import("../lib/auth-cookie.js");
      process.env.APP_URL = "";
      expect(isAuthCookieSecure()).toBe(false);
    });
  });

  describe("refreshCookieOptions", () => {
    // Refresh cookie options must be httpOnly, match the secure setting, and have 7-day expiry.
    // Expected: httpOnly=true, secure=true, sameSite=lax, path="/api/auth", maxAge=7 days in seconds.
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
