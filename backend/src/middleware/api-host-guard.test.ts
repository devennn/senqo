import { afterEach, describe, expect, it, vi } from "vitest";

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

describe("apiHostGuardMiddleware", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  // API_URL set → matching host passes in production.
  it("allows when host matches API_URL", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("API_URL", "demo-app.senqo.app");
    vi.stubEnv("FRONTEND_URL", "https://other.example.com");
    const c = mockContext("demo-app.senqo.app");
    const next = vi.fn();
    await apiHostGuardMiddleware(c, next);
    expect(next).toHaveBeenCalled();
  });

  // API_URL unset → FRONTEND_URL hostname is allowed.
  it("allows when API_URL is unset and host matches FRONTEND_URL", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("API_URL", "");
    vi.stubEnv("FRONTEND_URL", "https://demo-app.senqo.app");
    const c = mockContext("demo-app.senqo.app");
    const next = vi.fn();
    await apiHostGuardMiddleware(c, next);
    expect(next).toHaveBeenCalled();
  });

  // API_URL takes precedence over FRONTEND_URL fallback.
  it("prefers API_URL over FRONTEND_URL", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("API_URL", "api.example.com");
    vi.stubEnv("FRONTEND_URL", "https://app.example.com");
    const c = mockContext("app.example.com");
    const next = vi.fn();
    const response = await apiHostGuardMiddleware(c, next);
    expect(response).toBeDefined();
    expect((response as Response).status).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  // Host not on allow list → 403 forbidden_host.
  it("denies (403) when host not allowed in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("API_URL", "demo-app.senqo.app");
    vi.stubEnv("FRONTEND_URL", "https://demo-app.senqo.app");
    const c = mockContext("evil.com");
    const next = vi.fn();
    const response = await apiHostGuardMiddleware(c, next);
    expect((response as Response).status).toBe(403);
    await expect((response as Response).json()).resolves.toEqual({
      ok: false,
      error: "forbidden_host",
    });
    expect(next).not.toHaveBeenCalled();
  });

  // Non-production → host guard is skipped.
  it("allows any host when NODE_ENV is not production", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("API_URL", "");
    vi.stubEnv("FRONTEND_URL", "");
    const c = mockContext("evil.com");
    const next = vi.fn();
    await apiHostGuardMiddleware(c, next);
    expect(next).toHaveBeenCalled();
  });

  // Reverse proxy forwards public host via x-forwarded-host.
  it("uses x-forwarded-host when present", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("API_URL", "demo-app.senqo.app");
    const c = mockContext("internal", "demo-app.senqo.app");
    const next = vi.fn();
    await apiHostGuardMiddleware(c, next);
    expect(next).toHaveBeenCalled();
  });
});
