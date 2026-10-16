import { getConnInfo } from "@hono/node-server/conninfo";
import type { Context, MiddlewareHandler } from "hono";

type RateLimitOptions = {
  /**
   * Distinguishes limiter instances that share a request path (global vs
   * per-endpoint auth limits) so their windows never share a counter.
   */
  keyPrefix: string;
  windowMs: number;
  limit: number;
  /** When true, the request is not counted and never rejected. */
  skip?: (c: Context) => boolean;
};

type WindowEntry = {
  count: number;
  resetAt: number;
};

/** Upper bound so a spoofed-IP flood cannot grow the store without limit. */
const MAX_ENTRIES = 10_000;

const store = new Map<string, WindowEntry>();

/**
 * Client IP for rate-limit keys.
 *
 * Prefers `x-real-ip`, which the shipped nginx overwrites with the socket peer
 * address (`$remote_addr`), so client-controlled input cannot move the key.
 * Falls back to the LAST `X-Forwarded-For` entry (nginx appends the address it
 * actually saw, so earlier entries may be attacker-supplied), then to the Node
 * socket address for direct connections (local dev / unit tests).
 */
export function clientIp(c: Context): string {
  const realIp = c.req.header("x-real-ip")?.trim();
  if (realIp) return realIp;

  const forwarded = c.req.header("x-forwarded-for");
  if (forwarded) {
    const hops = forwarded
      .split(",")
      .map((hop) => hop.trim())
      .filter(Boolean);
    const lastHop = hops[hops.length - 1];
    if (lastHop) return lastHop;
  }

  try {
    const info = getConnInfo(c);
    if (info.remote.address) return info.remote.address;
  } catch {
    // No Node socket on this context (unit tests) — fall through.
  }
  return "unknown";
}

function getKey(c: Context, keyPrefix: string): string {
  return `${keyPrefix}|${clientIp(c)}|${c.req.path}`;
}

/** Keeps the store bounded when a client rotates keys (spoofed IPs, random paths). */
function evictIfNeeded(now: number): void {
  if (store.size <= MAX_ENTRIES) return;

  for (const [key, entry] of store.entries()) {
    if (now > entry.resetAt) store.delete(key);
  }

  while (store.size > MAX_ENTRIES) {
    let oldestKey: string | null = null;
    let oldestResetAt = Number.POSITIVE_INFINITY;
    for (const [key, entry] of store.entries()) {
      if (entry.resetAt < oldestResetAt) {
        oldestResetAt = entry.resetAt;
        oldestKey = key;
      }
    }
    if (!oldestKey) return;
    store.delete(oldestKey);
  }
}

export function rateLimit(options: RateLimitOptions): MiddlewareHandler {
  return async (c, next) => {
    if (options.skip?.(c)) {
      await next();
      return;
    }

    const key = getKey(c, options.keyPrefix);
    const now = Date.now();
    let entry = store.get(key);

    if (!entry || now > entry.resetAt) {
      entry = { count: 0, resetAt: now + options.windowMs };
      store.set(key, entry);
      evictIfNeeded(now);
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
