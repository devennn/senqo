import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./env.js", () => ({
  env: { apiKeyPepper: "test-pepper-value-for-unit-tests" },
}));

const { generateApiKeyMaterial, hashApiKey, getApiKeyVerificationHashes } = await import("./api-keys.js");

describe("generateApiKeyMaterial", () => {
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
  it("is deterministic (same input = same output)", () => {
    const key = "sk_senqo_deadbeefcafebabe1234567890abcdef";
    const h1 = hashApiKey(key);
    const h2 = hashApiKey(key);
    expect(h1).toBe(h2);
  });
});

describe("getApiKeyVerificationHashes", () => {
  it("returns array with current hash plus legacy hashes", () => {
    const key = "sk_senqo_testkey1234567890abcdef123456";
    const hashes = getApiKeyVerificationHashes(key);
    expect(hashes.length).toBeGreaterThanOrEqual(2);
    // first is current hash
    expect(hashes[0]).toBe(hashApiKey(key));
  });
});
