import { describe, it, expect } from "vitest";
import {
  LOGIN_BLOCK_MS,
  LOGIN_MAX_FAILURES,
  LOGIN_WINDOW_MS,
  clearLoginFailures,
  getLoginBlock,
  recordLoginFailure,
} from "./login-attempts.js";

const T0 = 1_700_000_000_000;

/** Records `count` failures for one ip+email pair. */
function recordFailures(ip: string, email: string, count: number, now = T0): void {
  for (let i = 0; i < count; i++) {
    recordLoginFailure(ip, email, now);
  }
}

describe("login attempts", () => {
  // A fresh account+IP pair has no history → attempts must be allowed.
  it("allows login when no failures were recorded", () => {
    expect(getLoginBlock("10.0.0.1", "fresh@example.com", T0)).toEqual({ blocked: false });
  });

  // Below the threshold the account must stay usable so ordinary typos are not punished.
  it("allows login while failures are below the threshold", () => {
    recordFailures("10.0.0.2", "under@example.com", LOGIN_MAX_FAILURES - 1);

    expect(getLoginBlock("10.0.0.2", "under@example.com", T0)).toEqual({ blocked: false });
  });

  // Security regression (S-03): reaching the threshold previously had no effect. The pair must be
  // blocked with a positive retry-after so the login route can answer 429 instead of guessing on.
  it("blocks once the failure threshold is reached", () => {
    recordFailures("10.0.0.3", "blocked@example.com", LOGIN_MAX_FAILURES);

    const block = getLoginBlock("10.0.0.3", "blocked@example.com", T0);

    expect(block.blocked).toBe(true);
    if (block.blocked) {
      expect(block.retryAfterSeconds).toBeGreaterThan(0);
      expect(block.retryAfterSeconds).toBeLessThanOrEqual(LOGIN_BLOCK_MS / 1000);
    }
  });

  // After the cool-down window passes the account must be usable again with a fresh failure count.
  it("unblocks after the cool-down window expires", () => {
    recordFailures("10.0.0.4", "cooldown@example.com", LOGIN_MAX_FAILURES);
    const afterBlock = T0 + LOGIN_BLOCK_MS + 1;

    expect(getLoginBlock("10.0.0.4", "cooldown@example.com", afterBlock)).toEqual({ blocked: false });

    recordFailures("10.0.0.4", "cooldown@example.com", LOGIN_MAX_FAILURES - 1, afterBlock);
    expect(getLoginBlock("10.0.0.4", "cooldown@example.com", afterBlock)).toEqual({ blocked: false });
  });

  // Failures older than the sliding window must not accumulate toward a block.
  it("does not count failures older than the window", () => {
    recordFailures("10.0.0.5", "stale@example.com", LOGIN_MAX_FAILURES - 1, T0);

    recordLoginFailure("10.0.0.5", "stale@example.com", T0 + LOGIN_WINDOW_MS + 1);

    expect(getLoginBlock("10.0.0.5", "stale@example.com", T0 + LOGIN_WINDOW_MS + 1)).toEqual({
      blocked: false,
    });
  });

  // A successful login clears the history so past typos cannot contribute to a future lockout.
  it("clears failures on a successful login", () => {
    recordFailures("10.0.0.6", "reset@example.com", LOGIN_MAX_FAILURES);
    expect(getLoginBlock("10.0.0.6", "reset@example.com", T0).blocked).toBe(true);

    clearLoginFailures("10.0.0.6", "reset@example.com");

    expect(getLoginBlock("10.0.0.6", "reset@example.com", T0)).toEqual({ blocked: false });
  });

  // The guard is per account AND per IP: one pair exhausting its budget must not lock out other
  // accounts or other IPs (no collateral denial of service).
  it("scopes failures to the exact ip + email pair", () => {
    recordFailures("10.0.0.7", "pair@example.com", LOGIN_MAX_FAILURES);

    expect(getLoginBlock("10.0.0.7", "pair@example.com", T0).blocked).toBe(true);
    expect(getLoginBlock("10.0.0.8", "pair@example.com", T0)).toEqual({ blocked: false });
    expect(getLoginBlock("10.0.0.7", "other@example.com", T0)).toEqual({ blocked: false });
  });
});
