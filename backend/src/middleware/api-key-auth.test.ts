import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";

const mockVerifyApiKey = vi.fn();
vi.mock("../repositories/api-keys.js", () => ({ verifyApiKey: mockVerifyApiKey }));

const { apiKeyAuthMiddleware } = await import("../middleware/api-key-auth.js");

function createApp() {
  const app = new Hono();
  app.use("/api/*", apiKeyAuthMiddleware);
  app.get("/api/test", (c) => c.json({ ok: true, workspaceId: c.get("workspaceId") }));
  return app;
}

beforeEach(() => { vi.clearAllMocks(); });

describe("apiKeyAuthMiddleware", () => {
  it("returns 401 when no x-api-key header", async () => {
    const app = createApp();
    const res = await app.request("/api/test");
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("invalid_api_key");
  });

  it("returns 401 when verifyApiKey returns ok false", async () => {
    mockVerifyApiKey.mockResolvedValue({ ok: false, reason: "invalid_api_key" });
    const app = createApp();
    const res = await app.request("/api/test", { headers: { "x-api-key": "bad-key" } });
    expect(res.status).toBe(401);
  });

  it("sets workspaceId and calls next for valid key", async () => {
    mockVerifyApiKey.mockResolvedValue({ ok: true, workspaceId: "ws-1" });
    const app = createApp();
    const res = await app.request("/api/test", { headers: { "x-api-key": "good-key" } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.workspaceId).toBe("ws-1");
  });
});
