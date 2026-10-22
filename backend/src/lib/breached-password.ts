import { createHash } from "node:crypto";

/**
 * Optional HaveIBeenPwned check (opt-in via `PASSWORD_BREACH_CHECK=on`).
 * Uses k-anonymity: only the first 5 characters of the SHA-1 hash are sent, so
 * the password itself never leaves the server.
 */
export async function isPasswordBreached(
  password: string,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  const sha1 = createHash("sha1").update(password).digest("hex").toUpperCase();
  const prefix = sha1.slice(0, 5);
  const suffix = sha1.slice(5);

  const response = await fetchImpl(`https://api.pwnedpasswords.com/range/${prefix}`, {
    headers: { "Add-Padding": "true" },
  });
  if (!response.ok) {
    throw new Error(`Password breach lookup failed (${response.status})`);
  }

  const body = await response.text();
  return body
    .split("\n")
    .map((line) => line.split(":")[0]?.trim().toUpperCase() ?? "")
    .some((candidate) => candidate === suffix);
}
