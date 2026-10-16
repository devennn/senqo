import { describe, it, expect } from "vitest";
import { Hono } from "hono";
import { clientIp, rateLimit } from "./rate-limit.js";

/** Minimal app exposing clientIp so tests can assert key derivation directly. */
function ipApp(): Hono {
  const app = new Hono();
  app.get("/ip", (c) => c.text(clientIp(c)));
  return app;
}

/** App with a single limited route; each test uses its own keyPrefix to isolate windows. */
function limitedApp(keyPrefix: string, limit: number): Hono {
  const app = new Hono();
  app.use("*", rateLimit({ keyPrefix, windowMs: 60_000, limit }));
  app.get("/x", (c) => c.json({ ok: true }));
  return app;
}

describe("clientIp", () => {
  // The shipped nginx overwrites x-real-ip with the socket peer address, so it is the only
  // trustworthy source: it must win even when the client prepends fake X-Forwarded-For hops.
  it("prefers x-real-ip over client-prepended X-Forwarded-For entries", async () => {
    const res = await ipApp().request("/ip", {
      headers: {
        "x-real-ip": "203.0.113.7",
        "x-forwarded-for": "6.6.6.6, 203.0.113.7",
      },
    });

    expect(await res.text()).toBe("203.0.113.7");
  });

  // Without x-real-ip, nginx appends the address it actually saw as the LAST XFF entry, so the
  // last entry must be used — earlier entries can be attacker-supplied.
  it("uses the last X-Forwarded-For entry when x-real-ip is absent", async () => {
    const res = await ipApp().request("/ip", {
      headers: { "x-forwarded-for": "6.6.6.6, 198.51.100.9" },
    });

    expect(await res.text()).toBe("198.51.100.9");
  });
});

describe("rateLimit", () => {
  // Security regression (S-02): the limiter previously keyed on the FIRST X-Forwarded-For entry,
  // which clients control — rotating it bypassed the limit entirely. With a fixed x-real-ip the
  // bucket must stay the same no matter what earlier XFF hops say.
  it("ignores rotating client-prepended X-Forwarded-For values when x-real-ip is fixed → 429 after limit", async () => {
    const app = limitedApp("spoof", 2);
    const headers = (fakeHop: string) => ({
      "x-real-ip": "203.0.113.10",
      "x-forwarded-for": `${fakeHop}, 203.0.113.10`,
    });

    const first = await app.request("/x", { headers: headers("1.1.1.1") });
    const second = await app.request("/x", { headers: headers("2.2.2.2") });
    const third = await app.request("/x", { headers: headers("3.3.3.3") });

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(third.status).toBe(429);
  });

  // Distinct client addresses must have independent windows so one noisy client cannot lock out
  // everyone else behind the same path.
  it("keeps separate windows per x-real-ip address", async () => {
    const app = limitedApp("per-ip", 1);

    const firstForA = await app.request("/x", { headers: { "x-real-ip": "203.0.113.20" } });
    const secondForA = await app.request("/x", { headers: { "x-real-ip": "203.0.113.20" } });
    const firstForB = await app.request("/x", { headers: { "x-real-ip": "203.0.113.21" } });

    expect(firstForA.status).toBe(200);
    expect(secondForA.status).toBe(429);
    expect(firstForB.status).toBe(200);
  });

  // Without any proxy headers (direct Node usage, local dev) requests must still be limited —
  // all of them share the socket/fallback bucket rather than escaping the window.
  it("limits requests with no proxy headers via the socket fallback bucket", async () => {
    const app = limitedApp("fallback", 1);

    const first = await app.request("/x");
    const second = await app.request("/x");

    expect(first.status).toBe(200);
    expect(second.status).toBe(429);
  });

  // The skip option exists for trusted internal traffic (the WhatsApp event webhook): a skipped
  // request must never count toward, or be rejected by, the window.
  it("never counts or rejects requests matched by skip", async () => {
    const app = new Hono();
    app.use("*", rateLimit({ keyPrefix: "skipped", windowMs: 60_000, limit: 1, skip: () => true }));
    app.get("/x", (c) => c.json({ ok: true }));

    const first = await app.request("/x");
    const second = await app.request("/x");
    const third = await app.request("/x");

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(third.status).toBe(200);
  });

  // Clients rely on the X-RateLimit-* headers to back off; remaining must decrement as the
  // window fills instead of always reporting the initial budget.
  it("decrements X-RateLimit-Remaining as requests consume the window", async () => {
    const app = limitedApp("headers", 3);

    const first = await app.request("/x", { headers: { "x-real-ip": "203.0.113.30" } });
    const second = await app.request("/x", { headers: { "x-real-ip": "203.0.113.30" } });

    expect(first.headers.get("X-RateLimit-Remaining")).toBe("2");
    expect(second.headers.get("X-RateLimit-Remaining")).toBe("1");
  });
});
