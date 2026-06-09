import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";

const mockValidateWorkspaceMembership = vi.fn();
const mockGetProfileForSettings = vi.fn();

vi.mock("../repositories/workspaces.js", () => ({
  validateWorkspaceMembership: (...args: unknown[]) => mockValidateWorkspaceMembership(...args),
}));

vi.mock("../repositories/profiles.js", () => ({
  getProfileForSettings: (...args: unknown[]) => mockGetProfileForSettings(...args),
}));

import { workspaceMiddleware } from "../middleware/workspace.js";

function createApp() {
  const app = new Hono<{ Variables: { userId: string; workspaceId: string } }>();
  app.use("*", async (c, next) => {
    c.set("userId", "user-123");
    await next();
  });
  app.use("*", workspaceMiddleware);
  app.get("/test", (c) => c.json({ workspaceId: c.get("workspaceId") }));
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("workspaceMiddleware", () => {
  it("returns 403 when user is not a workspace member", async () => {
    mockValidateWorkspaceMembership.mockResolvedValue(false);
    const app = createApp();
    const res = await app.request("/test", {
      headers: { "X-Workspace-Id": "ws-123" },
    });
    expect(res.status).toBe(403);
  });

  it("sets workspaceId when user is a member", async () => {
    mockValidateWorkspaceMembership.mockResolvedValue(true);
    const app = createApp();
    const res = await app.request("/test", {
      headers: { "X-Workspace-Id": "ws-123" },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.workspaceId).toBe("ws-123");
  });

  it("sets workspaceId from profile when X-Workspace-Id header is missing", async () => {
    mockGetProfileForSettings.mockResolvedValue({ workspace_id: "profile-ws-456" });
    const app = createApp();
    const res = await app.request("/test");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.workspaceId).toBe("profile-ws-456");
  });

  it("falls back to userId when no header and no profile", async () => {
    mockGetProfileForSettings.mockResolvedValue(null);
    const app = createApp();
    const res = await app.request("/test");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.workspaceId).toBe("user-123");
  });
});
