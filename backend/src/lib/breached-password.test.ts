import { createHash } from "node:crypto";
import { describe, it, expect, vi } from "vitest";
import { isPasswordBreached } from "./breached-password.js";

function sha1Of(password: string): string {
  return createHash("sha1").update(password).digest("hex").toUpperCase();
}

/** Builds an HIBP-style response body containing one line for the given password hash. */
function breachBodyFor(password: string, extraCount = 42): string {
  const hash = sha1Of(password);
  return `${hash.slice(5)}:${extraCount}\r\n0000000000000000000000000000000000A:1`;
}

describe("isPasswordBreached", () => {
  // A password whose suffix appears in the range response is flagged as breached.
  it("returns true when the password suffix is present in the response", async () => {
    const password = "correct-horse-battery-staple";
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => breachBodyFor(password),
    });

    expect(await isPasswordBreached(password, fetchMock as unknown as typeof fetch)).toBe(true);
  });

  // A password missing from the range response is not flagged.
  it("returns false when the suffix is not in the response", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => breachBodyFor("a-different-password"),
    });

    expect(
      await isPasswordBreached("correct-horse-battery-staple", fetchMock as unknown as typeof fetch),
    ).toBe(false);
  });

  // k-anonymity: only the 5-character SHA-1 prefix may travel — the password itself must never
  // appear in the request URL, or the check leaks the credential to the API.
  it("sends only the 5-character hash prefix, never the password", async () => {
    const password = "correct-horse-battery-staple";
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => "",
    });

    await isPasswordBreached(password, fetchMock as unknown as typeof fetch);

    const url = String(fetchMock.mock.calls[0]?.[0]);
    expect(url).toContain(`/range/${sha1Of(password).slice(0, 5)}`);
    expect(url).not.toContain(password);
  });

  // Error path: an API failure must surface as a rejection so the caller can decide to fail open
  // (current behavior logs and allows registration).
  it("throws when the API responds with an error", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      text: async () => "",
    });

    await expect(
      isPasswordBreached("correct-horse-battery-staple", fetchMock as unknown as typeof fetch),
    ).rejects.toThrow("Password breach lookup failed (503)");
  });
});
