import { describe, it, expect, vi, beforeEach } from "vitest";

const mockLookup = vi.fn();

vi.mock("node:dns/promises", () => ({
  lookup: mockLookup,
}));

const { resolveSafeFetchTarget } = await import("./ssrf.js");

const PUBLIC_ADDRESS = { address: "93.184.216.34", family: 4 };

beforeEach(() => {
  mockLookup.mockReset();
  mockLookup.mockResolvedValue([PUBLIC_ADDRESS]);
});

describe("resolveSafeFetchTarget", () => {
  // Only web URLs may ever leave the sandbox; other schemes (file, ftp) could reach
  // local resources the guard was never designed to police.
  it("rejects non-http(s) protocols", async () => {
    await expect(resolveSafeFetchTarget("ftp://example.com/file")).rejects.toThrow(
      "Only http(s) fetch URLs are allowed.",
    );
  });

  // Internal docker service names must stay unreachable from generated tool code.
  it("rejects blocked internal hostnames", async () => {
    await expect(resolveSafeFetchTarget("http://backend:3001/api")).rejects.toThrow(
      "Fetch hostname is not allowed.",
    );
  });

  // Private IPv4 literals bypass DNS entirely and must be refused before any lookup.
  it("rejects private IPv4 literals", async () => {
    await expect(resolveSafeFetchTarget("http://10.1.2.3/data")).rejects.toThrow(
      "Fetch to private addresses is not allowed.",
    );
  });

  // URL.hostname keeps the brackets on IPv6 literals — the guard must strip them or
  // http://[::1]/ slips past the loopback check.
  it("rejects bracketed IPv6 loopback literals", async () => {
    await expect(resolveSafeFetchTarget("http://[::1]/data")).rejects.toThrow(
      "Fetch to private addresses is not allowed.",
    );
  });

  // IPv4-mapped IPv6 literals resolve to the same private IPv4 ranges and must be refused.
  it("rejects IPv4-mapped IPv6 literals", async () => {
    await expect(resolveSafeFetchTarget("http://[::ffff:127.0.0.1]/data")).rejects.toThrow(
      "Fetch to private addresses is not allowed.",
    );
  });

  // A hostname that resolves to a private address (e.g. internal DNS names) is an SSRF
  // vector even though the literal hostname looks public.
  it("rejects hostnames resolving to a private address", async () => {
    mockLookup.mockResolvedValue([{ address: "192.168.1.10", family: 4 }]);

    await expect(resolveSafeFetchTarget("http://intranet.example.com/")).rejects.toThrow(
      "Fetch resolves to a private address.",
    );
  });

  // Safe targets must come back with a pinned address so callers connect to the exact
  // address that was validated (no second DNS lookup).
  it("returns the validated public address for a safe URL", async () => {
    const target = await resolveSafeFetchTarget("https://example.com/path?q=1");

    expect(target.address).toBe("93.184.216.34");
    expect(target.family).toBe(4);
    expect(target.url.hostname).toBe("example.com");
  });
});
