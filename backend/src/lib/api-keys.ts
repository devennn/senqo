import { createHash, createHmac, randomBytes } from "node:crypto";
import { env } from "./env.js";

const API_KEY_PREFIX = "sk_senqo_";
const API_KEY_BYTES = 24;

/** Current format: HMAC-SHA256 with server pepper (post-security remediation). */
export function hashApiKey(rawApiKey: string): string {
  return createHmac("sha256", env.apiKeyPepper)
    .update(rawApiKey)
    .digest("hex");
}

/** Legacy format before H3 remediation: SHA-256 of `pepper:rawKey` (pepper defaulted to ""). */
export function hashApiKeyLegacy(rawApiKey: string, pepper: string): string {
  return createHash("sha256")
    .update(`${pepper}:${rawApiKey}`)
    .digest("hex");
}

/** Candidate hashes for lookup — new first, then legacy variants for existing keys. */
export function getApiKeyVerificationHashes(rawApiKey: string): string[] {
  const pepper = env.apiKeyPepper;
  const candidates = [
    hashApiKey(rawApiKey),
    hashApiKeyLegacy(rawApiKey, pepper),
  ];
  if (pepper !== "") {
    candidates.push(hashApiKeyLegacy(rawApiKey, ""));
  }
  return [...new Set(candidates)];
}

export function generateApiKeyMaterial(): {
  rawKey: string;
  keyPrefix: string;
  keyHash: string;
} {
  const token = randomBytes(API_KEY_BYTES).toString("hex");
  const rawKey = `${API_KEY_PREFIX}${token}`;
  return {
    rawKey,
    keyPrefix: rawKey.slice(0, 12),
    keyHash: hashApiKey(rawKey),
  };
}
