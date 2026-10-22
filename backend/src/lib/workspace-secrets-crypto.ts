import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;
const AUTH_TAG_LENGTH = 16;

function keyBytes(): Buffer {
  const raw = process.env.WORKSPACE_SECRETS_KEY;
  if (!raw) {
    throw new Error("WORKSPACE_SECRETS_KEY environment variable is not set");
  }
  // Strictly require a 32-byte hex key: older builds silently padded short or
  // non-hex values, which produced low-entropy keys (S-07).
  if (!/^[0-9a-f]{64}$/i.test(raw)) {
    throw new Error(
      "WORKSPACE_SECRETS_KEY must be 64 hexadecimal characters (32 bytes) — generate one with `openssl rand -hex 32`.",
    );
  }
  return Buffer.from(raw, "hex");
}

export function encryptWorkspaceSecret(plaintext: string): {
  ciphertext: string;
  iv: string;
  tag: string;
  valueHint: string;
} {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, keyBytes(), iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  const trimmed = plaintext.trim();
  const valueHint = trimmed.length <= 4 ? "****" : `••••${trimmed.slice(-4)}`;
  return {
    ciphertext: encrypted.toString("base64"),
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    valueHint,
  };
}

export function decryptWorkspaceSecret(input: {
  ciphertext: string;
  iv: string;
  tag: string;
}): string {
  const decipher = createDecipheriv(
    ALGORITHM,
    keyBytes(),
    Buffer.from(input.iv, "base64"),
    { authTagLength: AUTH_TAG_LENGTH },
  );
  decipher.setAuthTag(Buffer.from(input.tag, "base64"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(input.ciphertext, "base64")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}
