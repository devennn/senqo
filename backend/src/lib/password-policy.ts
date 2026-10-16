/**
 * Password policy (S-10). NIST 800-63B style: a length floor plus a breach/common
 * blocklist instead of composition rules. The list stays local/offline; the
 * optional HaveIBeenPwned check lives in `breached-password.ts`.
 */
export const PASSWORD_MIN_LENGTH = 12;

/** Common or leaked passwords (all ≥ PASSWORD_MIN_LENGTH so they cannot pass on length). */
const COMMON_PASSWORDS = new Set([
  "123456789012",
  "1234567890123",
  "12345678901234",
  "123456789012345",
  "aaaaaaaaaaaa",
  "111111111111",
  "000000000000",
  "abcdefghijkl",
  "qwertyuiop12",
  "qwertyqwerty",
  "qwerty123456",
  "1qaz2wsx3edc",
  "zaq12wsxcde3",
  "asdfghjkl123",
  "password1234",
  "password12345",
  "passwordpassword",
  "letmeinletmein",
  "iloveyou1234",
  "welcome12345",
  "adminadmin12",
  "administrator",
  "changeme1234",
  "changemenow1",
  "mypassword12",
  "sunshine1234",
  "princess1234",
  "football1234",
  "baseball1234",
  "superman1234",
  "monkeymonkey",
  "dragon123456",
  "starwars1234",
  "computer1234",
  "whatever1234",
  "trustno1trust",
  "senqo12345678",
]);

export type PasswordPolicyResult =
  | { ok: true }
  | { ok: false; reason: "too_short" | "too_common" };

export function checkPasswordPolicy(password: string): PasswordPolicyResult {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return { ok: false, reason: "too_short" };
  }
  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    return { ok: false, reason: "too_common" };
  }
  return { ok: true };
}
