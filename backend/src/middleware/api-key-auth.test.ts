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
  // No x-api-key header in the request → 401 is returned to reject unauthenticated access, needed to ensure the guard blocks missing credentials.
  it("returns 401 when no x-api-key header", async () => {
    const app = createApp();
    const res = await app.request("/api/test");
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("invalid_api_key");
  });

  // API key is sent but verifyApiKey returns ok:false → 401 is returned, needed to ensure invalid keys are rejected at the middleware boundary.
  it("returns 401 when verifyApiKey returns ok false", async () => {
    mockVerifyApiKey.mockResolvedValue({ ok: false, reason: "invalid_api_key" });
    const app = createApp();
    const res = await app.request("/api/test", { headers: { "x-api-key": "bad-key" } });
    expect(res.status).toBe(401);
  });

  // A valid API key is verified and workspaceId is set on the context → 200 and correct workspace is returned, needed to confirm auth passes workspace context through.
  it("sets workspaceId and calls next for valid key", async () => {
    mockVerifyApiKey.mockResolvedValue({ ok: true, workspaceId: "ws-1" });
    const app = createApp();
    const res = await app.request("/api/test", { headers: { "x-api-key": "good-key" } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.workspaceId).toBe("ws-1");
  });
});
