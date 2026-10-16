import { describe, it, expect, vi, afterEach } from "vitest";
import { Hono } from "hono";
import { requestLogger } from "./request-logger.js";

function appWithLogger(): Hono {
  const app = new Hono();
  app.use("*", requestLogger());
  app.get("/health", (c) => c.json({ ok: true }));
  app.get("/missing", (c) => c.json({ error: "nope" }, 404));
  return app;
}

describe("requestLogger", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Security regression (S-04): the previous logger wrote full URLs — including secrets in query
  // strings — to disk. Now the query string must never appear in any log line.
  it("never logs the query string", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await appWithLogger().request("/health?token=TOKENLEAK-PROOF-9f8e7d6c");

    const logged = logSpy.mock.calls.map((call) => call.join(" ")).join("\n");
    expect(logged).toContain("/health");
    expect(logged).not.toContain("TOKENLEAK-PROOF-9f8e7d6c");
    expect(logged).not.toContain("?");
  });

  // Operators rely on access logs to triage incidents; the completion line must carry the real
  // response status for the request.
  it("logs the response status after completing the request", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await appWithLogger().request("/missing");

    const logged = logSpy.mock.calls.map((call) => call.join(" ")).join("\n");
    expect(logged).toContain("/missing");
    expect(logged).toContain("404");
  });
});
