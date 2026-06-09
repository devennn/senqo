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
