import { describe, it, expect } from "vitest";
import { PASSWORD_MIN_LENGTH, checkPasswordPolicy } from "./password-policy.js";

describe("checkPasswordPolicy", () => {
  // Happy path: a long password that is not in the common list must pass.
  it("accepts a long uncommon password", () => {
    expect(checkPasswordPolicy("correct-horse-battery-staple")).toEqual({ ok: true });
  });

  // Passwords below the length floor are rejected, with the reason distinguishing the case so
  // callers can map it to the right error.
  it("rejects passwords below the minimum length", () => {
    expect(checkPasswordPolicy("short")).toEqual({ ok: false, reason: "too_short" });
  });

  // Security regression (S-10): a leaked-but-long password (e.g. "qwertyqwerty") must not pass —
  // length alone is not enough.
  it("rejects a common breached password even when long enough", () => {
    expect(checkPasswordPolicy("qwertyqwerty")).toEqual({ ok: false, reason: "too_common" });
  });

  // The blocklist check is case-insensitive: capitalization must not defeat it.
  it("rejects common passwords regardless of case", () => {
    expect(checkPasswordPolicy("QwertyQwerty")).toEqual({ ok: false, reason: "too_common" });
  });

  // The floor is exported so routes, UI hints, and tests cannot drift apart.
  it("exposes the minimum length it enforces", () => {
    const boundary = "x".repeat(PASSWORD_MIN_LENGTH);

    expect(checkPasswordPolicy(boundary)).toEqual({ ok: true });
    expect(checkPasswordPolicy("x".repeat(PASSWORD_MIN_LENGTH - 1))).toEqual({
      ok: false,
      reason: "too_short",
    });
  });
});
