import type { Context, MiddlewareHandler } from "hono";

type RateLimitOptions = {
  windowMs: number;
  limit: number;
  /** When true, the request is not counted and never rejected. */
  skip?: (c: Context) => boolean;
};

type WindowEntry = {
  count: number;
  resetAt: number;
};

const store = new Map<string, WindowEntry>();

function getKey(c: { req: { url: string; header: (name: string) => string | undefined } }): string {
  const ip = c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  return `${ip}:${c.req.url.split("?")[0]}`;
}

export function rateLimit(options: RateLimitOptions): MiddlewareHandler {
  return async (c, next) => {
    if (options.skip?.(c)) {
      await next();
      return;
    }

    const key = getKey(c);
    const now = Date.now();
    let entry = store.get(key);

    if (!entry || now > entry.resetAt) {
      entry = { count: 0, resetAt: now + options.windowMs };
      store.set(key, entry);
    }

    entry.count++;

    const remaining = Math.max(0, options.limit - entry.count);
    c.header("X-RateLimit-Limit", String(options.limit));
    c.header("X-RateLimit-Remaining", String(remaining));
    c.header("X-RateLimit-Reset", String(entry.resetAt));

    if (entry.count > options.limit) {
      return c.json({ error: "rate_limit_exceeded" }, 429);
    }

    await next();
  };
}

export function cleanupExpiredEntries(): void {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (now > entry.resetAt) {
      store.delete(key);
    }
  }
}

setInterval(cleanupExpiredEntries, 5 * 60 * 1000);
