/**
 * Failed-login throttling (S-03): counts cracked-attempts per client IP + account
 * and blocks further attempts for a cool-down window once the threshold is hit.
 *
 * In-memory by design, same trade-off as the request rate limiter: the backend
 * runs as a single instance, and counters resetting on deploy is not something
 * an attacker can trigger on demand.
 */

type AttemptEntry = {
  failures: number;
  windowStart: number;
  /** Epoch ms until which attempts are refused; 0 when not blocked. */
  blockedUntil: number;
};

export type LoginBlock =
  | { blocked: false }
  | { blocked: true; retryAfterSeconds: number };

export const LOGIN_WINDOW_MS = 15 * 60 * 1000;
export const LOGIN_MAX_FAILURES = 10;
export const LOGIN_BLOCK_MS = 15 * 60 * 1000;

/** Upper bound so rotating keys cannot grow the map without limit. */
const MAX_ENTRIES = 10_000;

const attempts = new Map<string, AttemptEntry>();

function attemptKey(ip: string, email: string): string {
  return `${ip}|${email}`;
}

/** Keeps the map bounded; Map insertion order evicts the oldest keys first. */
function evictIfNeeded(): void {
  if (attempts.size <= MAX_ENTRIES) return;
  let excess = attempts.size - MAX_ENTRIES;
  for (const key of attempts.keys()) {
    attempts.delete(key);
    if (--excess <= 0) return;
  }
}

export function getLoginBlock(
  ip: string,
  email: string,
  now: number = Date.now(),
): LoginBlock {
  const key = attemptKey(ip, email);
  const entry = attempts.get(key);
  if (!entry) return { blocked: false };

  if (entry.blockedUntil > now) {
    return {
      blocked: true,
      retryAfterSeconds: Math.max(1, Math.ceil((entry.blockedUntil - now) / 1000)),
    };
  }

  // Block expired, or the failure window went stale — start clean next time.
  if (entry.blockedUntil > 0 || now - entry.windowStart > LOGIN_WINDOW_MS) {
    attempts.delete(key);
  }
  return { blocked: false };
}

export function recordLoginFailure(
  ip: string,
  email: string,
  now: number = Date.now(),
): void {
  const key = attemptKey(ip, email);
  const entry = attempts.get(key);

  if (!entry || entry.blockedUntil > 0 || now - entry.windowStart > LOGIN_WINDOW_MS) {
    attempts.set(key, { failures: 1, windowStart: now, blockedUntil: 0 });
    evictIfNeeded();
    return;
  }

  entry.failures += 1;
  if (entry.failures >= LOGIN_MAX_FAILURES) {
    entry.blockedUntil = now + LOGIN_BLOCK_MS;
  }
}

export function clearLoginFailures(ip: string, email: string): void {
  attempts.delete(attemptKey(ip, email));
}
