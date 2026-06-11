import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockFetch = vi.fn();
global.fetch = mockFetch;

const mockGetAccessToken = vi.fn();
const mockRefreshAccessToken = vi.fn();
const mockRemoveAuthTokens = vi.fn();
const mockGetActiveWorkspaceId = vi.fn();
const mockSaveAuthTokens = vi.fn();

vi.mock("../lib/auth-client.js", () => ({
  getAccessToken: mockGetAccessToken,
  refreshAccessToken: mockRefreshAccessToken,
  removeAuthTokens: mockRemoveAuthTokens,
  saveAuthTokens: mockSaveAuthTokens,
}));

vi.mock("../lib/active-workspace.js", () => ({
  getActiveWorkspaceId: mockGetActiveWorkspaceId,
}));

const originalLocation = { ...window.location };

beforeEach(() => {
  vi.clearAllMocks();
  mockGetAccessToken.mockResolvedValue("valid-token");
  mockGetActiveWorkspaceId.mockReturnValue("ws-123");
  delete (window as { location?: Location }).location;
  (window as { location?: Partial<Location> }).location = { ...originalLocation, assign: vi.fn() };
});

afterEach(() => {
  (window as { location?: Partial<Location> }).location = originalLocation;
});

describe("api client", () => {
  describe("Token handling", () => {
    // Confirms the API client sends the access token in the Authorization header.
    // Ensures every request is authenticated and the backend can identify the caller.
    it("attaches Authorization: Bearer header", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: "test" }),
      });

      const { api } = await import("../lib/api.js");
      await api.get("/test");

      const headers = mockFetch.mock.calls[0]?.[1]?.headers;
      expect(headers.Authorization).toBe("Bearer valid-token");
    });

    // Confirms the API client sends the active workspace ID in the X-Workspace-Id header.
    // Critical for multi-workspace scoping so the backend serves the correct workspace data.
    it("attaches X-Workspace-Id header", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: "test" }),
      });

      const { api } = await import("../lib/api.js");
      await api.get("/test");

      const headers = mockFetch.mock.calls[0]?.[1]?.headers;
      expect(headers["X-Workspace-Id"]).toBe("ws-123");
    });
  });

  describe("Token refresh on 401", () => {
    // Verifies that a 401 response triggers a token refresh and retries the original request.
    // Prevents users from being kicked out mid-session when their access token expires.
    it("auto-refreshes token on 401 and retries", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          json: () => Promise.resolve({ error: "Unauthorized" }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ data: "refreshed" }),
        });

      mockRefreshAccessToken.mockResolvedValue("new-token");

      const { api } = await import("../lib/api.js");
      await api.get("/test");

      expect(mockRefreshAccessToken).toHaveBeenCalled();
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    // Verifies that when both access and refresh tokens are invalid/null, the user is redirected to sign-in.
    // Ensures the security boundary holds: no stale sessions linger after full token expiry.
    it("redirects to sign-in when both tokens are invalid", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ error: "Unauthorized" }),
      });

      mockGetAccessToken.mockResolvedValue(null);
      mockRefreshAccessToken.mockResolvedValue(null);

      const { api } = await import("../lib/api.js");
      await expect(api.get("/test")).rejects.toThrow("Unauthorized");
      expect(mockRemoveAuthTokens).toHaveBeenCalled();
    });
  });

  describe("FormData handling", () => {
    // Confirms that Content-Type is not set when sending FormData, letting the browser set it with the boundary.
    // Prevents malformed multipart uploads that would fail on the server side.
    it("does not set Content-Type for FormData requests", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: "uploaded" }),
      });

      const { api } = await import("../lib/api.js");
      const formData = new FormData();
      formData.append("file", new Blob(["test"]), "test.txt");
      await api.postForm("/upload", formData);

      const headers = mockFetch.mock.calls[0]?.[1]?.headers;
      expect(headers["Content-Type"]).toBeUndefined();
    });
  });

  describe("workspaceId override", () => {
    // Verifies that a per-request workspaceId override takes precedence over the active workspace.
    // Needed for cross-workspace operations like admin tools that target a different workspace.
    it("uses provided workspaceId override", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: "test" }),
      });

      const { api } = await import("../lib/api.js");
      await api.get("/test", { workspaceId: "override-ws" });

      const headers = mockFetch.mock.calls[0]?.[1]?.headers;
      expect(headers["X-Workspace-Id"]).toBe("override-ws");
    });
  });
});
