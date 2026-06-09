import { describe, it, expect, vi, beforeEach } from "vitest";

const { apiHostGuardMiddleware } = await import("../middleware/api-host-guard.js");

function mockContext(host: string | null, forwardedHost: string | null = null) {
  const header = vi.fn((name: string) => {
    if (name === "host") return host;
    if (name === "x-forwarded-host") return forwardedHost;
    return null;
  });
  const json = vi.fn((body: unknown, status: number) => {
    return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  });
  return { req: { header }, json } as unknown as Parameters<typeof apiHostGuardMiddleware>[0];
}

beforeEach(() => { vi.clearAllMocks(); });

describe("apiHostGuardMiddleware", () => {
  it("allows when host matches PUBLIC_API_ALLOWED_HOSTS", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("PUBLIC_API_ALLOWED_HOSTS", "api.example.com");
    const c = mockContext("api.example.com");
    const next = vi.fn();
    await apiHostGuardMiddleware(c, next);
    expect(next).toHaveBeenCalled();
  });

  it("denies (403) when host not allowed in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("PUBLIC_API_ALLOWED_HOSTS", "api.example.com");
    const c = mockContext("evil.com");
    const next = vi.fn();
    const response = await apiHostGuardMiddleware(c, next);
    expect(response).toBeDefined();
    expect((response as Response).status).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });
});
