import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;

function keyBytes(): Buffer {
  const raw = process.env.WORKSPACE_SECRETS_KEY;
  if (!raw) {
    throw new Error("WORKSPACE_SECRETS_KEY environment variable is not set");
  }
  if (raw.length === 64 && /^[0-9a-f]+$/i.test(raw)) {
    return Buffer.from(raw, "hex");
  }
  return Buffer.from(raw.padEnd(32, "0").slice(0, 32), "utf8");
}

export function encryptWorkspaceSecret(plaintext: string): {
  ciphertext: string;
  iv: string;
  tag: string;
  valueHint: string;
} {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, keyBytes(), iv);
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
  );
  decipher.setAuthTag(Buffer.from(input.tag, "base64"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(input.ciphertext, "base64")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}
