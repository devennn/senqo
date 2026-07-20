/** Digits-only phone (country code + number, no leading +) for storage/API. */
export function normalizeHandoffPhoneDigits(input: string): string {
  return input.trim().replace(/\D/g, "");
}

/** Display form with country-code plus, e.g. 60123456789 → +60123456789. */
export function formatHandoffPhoneDisplay(input: string | null | undefined): string {
  const digits = normalizeHandoffPhoneDigits(input ?? "");
  return digits ? `+${digits}` : "";
}

export function isHandoffPhoneValid(digits: string): boolean {
  return digits.length >= 8 && digits.length <= 15;
}

/** True when the candidate matches any WhatsApp connection phone in the workspace. */
export function isHandoffPhoneAConnection(
  candidateDigits: string,
  connectionPhoneDigits: readonly string[],
): boolean {
  if (!candidateDigits) return false;
  return connectionPhoneDigits.includes(candidateDigits);
}

export function connectionPhonesToDigits(
  phones: Array<string | null | undefined>,
): string[] {
  const out: string[] = [];
  for (const phone of phones) {
    if (!phone) continue;
    const digits = normalizeHandoffPhoneDigits(phone);
    if (isHandoffPhoneValid(digits)) out.push(digits);
  }
  return [...new Set(out)];
}
