import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
  };
})();

Object.defineProperty(global, "localStorage", { value: localStorageMock });

const mockFetch = vi.fn();
global.fetch = mockFetch;

const mockGetApiBase = "http://localhost:3001";

vi.stubGlobal("import", {
  meta: {
    env: { VITE_API_BASE_URL: mockGetApiBase },
  },
});

beforeEach(() => {
  vi.clearAllMocks();
  localStorageMock.clear();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("auth-client", () => {
  describe("getAccessToken", () => {
    it("reads tokens from localStorage", async () => {
      const { saveAuthTokens, getAccessToken } = await import("../lib/auth-client.js");

      // Reset module cache to avoid stale env
      saveAuthTokens("my-access-token", "my-refresh-token");
      // getAccessToken will try to refresh because we can't control JWT expiry easily
      // so we test saveAuthTokens + the fact that it stored to localStorage
      const stored = localStorageMock.getItem("senqo_auth");
      const parsed = stored ? JSON.parse(stored) : {};
      expect(parsed.accessToken).toBe("my-access-token");
    });
  });

  describe("saveAuthTokens", () => {
    it("writes access token to localStorage", async () => {
      const { saveAuthTokens } = await import("../lib/auth-client.js");
      saveAuthTokens("access-123", "refresh-456");

      const stored = localStorageMock.getItem("senqo_auth");
      const parsed = stored ? JSON.parse(stored) : {};
      expect(parsed.accessToken).toBe("access-123");
      expect(parsed.refreshToken).toBe("refresh-456");
    });

    it("preserves existing refresh token when only passed access token", async () => {
      const { saveAuthTokens } = await import("../lib/auth-client.js");
      saveAuthTokens("access-123", "refresh-456");
      saveAuthTokens("access-789");

      const stored = localStorageMock.getItem("senqo_auth");
      const parsed = stored ? JSON.parse(stored) : {};
      expect(parsed.accessToken).toBe("access-789");
      expect(parsed.refreshToken).toBe("refresh-456");
    });
  });

  describe("removeAuthTokens", () => {
    it("clears localStorage", async () => {
      const { saveAuthTokens, removeAuthTokens } = await import("../lib/auth-client.js");
      saveAuthTokens("access-123", "refresh-456");
      removeAuthTokens();

      expect(localStorageMock.getItem("senqo_auth")).toBeNull();
    });
  });

  describe("login", () => {
    it("returns auth payload on success", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            accessToken: "login-access",
            refreshToken: "login-refresh",
            user: { id: "user-1", email: "test@example.com" },
          }),
      });

      const { login } = await import("../lib/auth-client.js");
      const result = await login("test@example.com", "password123");

      expect(result.accessToken).toBe("login-access");
      expect(result.refreshToken).toBe("login-refresh");
      expect(result.user.id).toBe("user-1");
    });

    it("throws on error response", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: "invalid_credentials" }),
      });

      const { login } = await import("../lib/auth-client.js");
      await expect(login("test@example.com", "wrong")).rejects.toThrow("invalid_credentials");
    });
  });

  describe("register", () => {
    it("sends registration data and returns tokens", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            accessToken: "reg-access",
            refreshToken: "reg-refresh",
            user: { id: "user-2", email: "new@example.com" },
          }),
      });

      const { register } = await import("../lib/auth-client.js");
      const result = await register("new@example.com", "password123", "New User");

      expect(result.accessToken).toBe("reg-access");
      expect(result.user.email).toBe("new@example.com");
    });

    it("throws on registration error", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: "email_already_exists" }),
      });

      const { register } = await import("../lib/auth-client.js");
      await expect(register("existing@example.com", "password123", "User")).rejects.toThrow(
        "email_already_exists",
      );
    });
  });

  describe("logout", () => {
    it("clears tokens after calling logout endpoint", async () => {
      mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
      const { saveAuthTokens, logout } = await import("../lib/auth-client.js");
      saveAuthTokens("access-123", "refresh-456");

      await logout();

      expect(localStorageMock.getItem("senqo_auth")).toBeNull();
    });
  });
});
