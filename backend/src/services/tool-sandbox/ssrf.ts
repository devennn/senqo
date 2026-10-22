import { lookup } from "node:dns/promises";

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "metadata.google.internal",
  "whatsapp",
  "postgres",
  "backend",
]);

function isPrivateIpv4(host: string): boolean {
  const parts = host.split(".").map((p) => Number(p));
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return false;
  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
}

/** Converts an IPv4-mapped IPv6 host to its IPv4 form; null when not mapped. */
function ipv4MappedToIpv4(host: string): string | null {
  const match = /^::ffff:(.+)$/.exec(host);
  if (!match) return null;
  const rest = match[1];
  if (rest.includes(".")) return rest;
  // The URL parser normalizes mapped literals to hex ("::ffff:7f00:1").
  const parts = rest.split(":");
  if (parts.length !== 2) return null;
  const high = Number.parseInt(parts[0], 16);
  const low = Number.parseInt(parts[1], 16);
  if (!Number.isFinite(high) || !Number.isFinite(low)) return null;
  return [high >> 8, high & 0xff, low >> 8, low & 0xff].join(".");
}

function isPrivateIpv6(host: string): boolean {
  const normalized = host.toLowerCase();
  // IPv4-mapped addresses reach the same private ranges as IPv4.
  const mapped = ipv4MappedToIpv4(normalized);
  if (mapped) return isPrivateIpv4(mapped);
  return (
    normalized === "::" ||
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe80")
  );
}

export type SafeFetchTarget = {
  url: URL;
  /** Address validated here and pinned for the actual connection (no second DNS lookup). */
  address: string;
  family: 4 | 6;
};

/**
 * Validates a fetch URL and resolves it to a public address exactly once.
 *
 * Callers must connect to the returned `address` (e.g. via a pinned undici agent)
 * instead of letting fetch resolve the hostname again — a second lookup could
 * return a private address after this check (DNS-rebinding TOCTOU, S-06).
 */
export async function resolveSafeFetchTarget(
  urlString: string,
): Promise<SafeFetchTarget> {
  let parsed: URL;
  try {
    parsed = new URL(urlString);
  } catch {
    throw new Error("Invalid fetch URL.");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Only http(s) fetch URLs are allowed.");
  }
  const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (BLOCKED_HOSTNAMES.has(hostname)) {
    throw new Error("Fetch hostname is not allowed.");
  }
  if (isPrivateIpv4(hostname) || isPrivateIpv6(hostname)) {
    throw new Error("Fetch to private addresses is not allowed.");
  }

  const resolved = await lookup(hostname, { all: true });
  for (const entry of resolved) {
    if (isPrivateIpv4(entry.address) || isPrivateIpv6(entry.address)) {
      throw new Error("Fetch resolves to a private address.");
    }
  }
  const first = resolved[0];
  if (!first) {
    throw new Error("Fetch hostname did not resolve.");
  }

  return {
    url: parsed,
    address: first.address,
    family: first.family === 6 ? 6 : 4,
  };
}
