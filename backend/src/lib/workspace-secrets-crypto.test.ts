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
    process.env.WORKSPACE_SECRETS_KEY = original;
  });

  it("encryptWorkspaceSecret → decryptWorkspaceSecret round-trips plaintext", () => {
    const encrypted = encryptWorkspaceSecret("super-secret-value");
    const decrypted = decryptWorkspaceSecret(encrypted);
    expect(decrypted).toBe("super-secret-value");
    expect(encrypted.valueHint).toBe("••••alue");
  });
});
