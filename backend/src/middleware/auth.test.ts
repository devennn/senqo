import { describe, it, expect, vi } from "vitest";
import { Hono } from "hono";
import { authMiddleware } from "../middleware/auth.js";
import { verifyToken } from "../lib/auth-jwt.js";

vi.mock("../lib/auth-jwt.js", () => ({
  verifyToken: vi.fn(),
}));

const verifyTokenMock = vi.mocked(verifyToken);

function createApp() {
  const app = new Hono<{ Variables: { userId: string } }>();
  app.use("/protected/*", authMiddleware);
  app.get("/protected/hello", (c) => c.json({ userId: c.get("userId") }));
  return app;
}

describe("authMiddleware", () => {
  it("returns 401 when no Bearer token is present", async () => {
    const app = createApp();
    const res = await app.request("/protected/hello");
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("returns 401 when token is invalid", async () => {
    verifyTokenMock.mockResolvedValue(null);
    const app = createApp();
    const res = await app.request("/protected/hello", {
      headers: { Authorization: "Bearer bad-token" },
    });
    expect(res.status).toBe(401);
  });

  it("sets userId on context and calls next for valid token", async () => {
    verifyTokenMock.mockResolvedValue({ userId: "user-123" });
    const app = createApp();
    const res = await app.request("/protected/hello", {
      headers: { Authorization: "Bearer valid-token" },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.userId).toBe("user-123");
  });
});
