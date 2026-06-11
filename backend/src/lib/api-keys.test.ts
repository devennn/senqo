import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./env.js", () => ({
  env: { apiKeyPepper: "test-pepper-value-for-unit-tests" },
}));

const { generateApiKeyMaterial, hashApiKey, getApiKeyVerificationHashes } = await import("./api-keys.js");

describe("generateApiKeyMaterial", () => {
  // Generates a fresh API key with the expected prefix, non-empty raw key, hash, and prefix.
  // Expected: rawKey starts with "sk_senqo_", all fields are non-empty, prefix is first 12 chars.
  it("returns rawKey, keyPrefix, keyHash as non-empty strings", () => {
    const result = generateApiKeyMaterial();
    expect(result.rawKey.length).toBeGreaterThan(0);
    expect(result.keyPrefix.length).toBeGreaterThan(0);
    expect(result.keyHash.length).toBeGreaterThan(0);
    expect(result.rawKey.startsWith("sk_senqo_")).toBe(true);
    expect(result.keyPrefix).toBe(result.rawKey.slice(0, 12));
  });
});

describe("hashApiKey", () => {
  // The hash function must be deterministic — same key should produce identical hashes.
  // Expected: two calls with the same raw key return the exact same hash string.
  it("is deterministic (same input = same output)", () => {
    const key = "sk_senqo_deadbeefcafebabe1234567890abcdef";
    const h1 = hashApiKey(key);
    const h2 = hashApiKey(key);
    expect(h1).toBe(h2);
  });
});

describe("getApiKeyVerificationHashes", () => {
  // Returns an array of hashes for verification, including current and legacy hash methods.
  // Expected: at least 2 hashes; the first entry matches the current hashApiKey output.
  it("returns array with current hash plus legacy hashes", () => {
    const key = "sk_senqo_testkey1234567890abcdef123456";
    const hashes = getApiKeyVerificationHashes(key);
    expect(hashes.length).toBeGreaterThanOrEqual(2);
    // first is current hash
    expect(hashes[0]).toBe(hashApiKey(key));
  });
});
