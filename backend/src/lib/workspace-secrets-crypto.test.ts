import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  decryptWorkspaceSecret,
  encryptWorkspaceSecret,
} from "./workspace-secrets-crypto.js";

describe("workspace-secrets-crypto", () => {
  const original = process.env.WORKSPACE_SECRETS_KEY;

  beforeEach(() => {
    process.env.WORKSPACE_SECRETS_KEY = "a".repeat(64);
  });

  afterEach(() => {
    if (original === undefined) {
      delete process.env.WORKSPACE_SECRETS_KEY;
    } else {
      process.env.WORKSPACE_SECRETS_KEY = original;
    }
  });

  // Encrypting and then decrypting a plaintext should return the original value.
  // Expected: decrypted value matches the input; valueHint shows the last 4 masked chars.
  it("encryptWorkspaceSecret → decryptWorkspaceSecret round-trips plaintext", () => {
    const encrypted = encryptWorkspaceSecret("super-secret-value");
    const decrypted = decryptWorkspaceSecret(encrypted);
    expect(decrypted).toBe("super-secret-value");
    expect(encrypted.valueHint).toBe("••••alue");
  });

  // Security regression (S-07): non-hex keys used to be zero-padded into a weak key instead of
  // failing. They must now be rejected so silently-weak encryption cannot ship.
  it("rejects a non-hex key instead of padding it", () => {
    process.env.WORKSPACE_SECRETS_KEY = "not-a-valid-key";

    expect(() => encryptWorkspaceSecret("value")).toThrow(
      "WORKSPACE_SECRETS_KEY must be 64 hexadecimal characters",
    );
  });

  // A missing key must fail loudly rather than fall back to any default material.
  it("rejects a missing key", () => {
    delete process.env.WORKSPACE_SECRETS_KEY;

    expect(() => encryptWorkspaceSecret("value")).toThrow(
      "WORKSPACE_SECRETS_KEY environment variable is not set",
    );
  });

  // GCM authenticity: a tampered auth tag must make decryption fail instead of returning garbage.
  it("rejects a tampered auth tag", () => {
    const sealed = encryptWorkspaceSecret("value");
    const tamperedTag = Buffer.from(sealed.tag, "base64");
    tamperedTag[0] = tamperedTag[0] ^ 0xff;

    expect(() =>
      decryptWorkspaceSecret({ ...sealed, tag: tamperedTag.toString("base64") }),
    ).toThrow();
  });
});
