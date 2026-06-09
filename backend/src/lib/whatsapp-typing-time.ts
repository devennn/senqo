/** Green API SendTyping: typingTime must be between 1000 and 20000 ms. */
export const WHATSAPP_TYPING_TIME_MIN_MS = 1000;
export const WHATSAPP_TYPING_TIME_MAX_MS = 20000;

/** ~5 characters per second — close to natural mobile typing speed. */
const WHATSAPP_TYPING_MS_PER_CHAR = 200;

export function estimateWhatsappTypingTimeMs(text: string): number {
  const length = text.trim().length;
  if (length === 0) {
    return WHATSAPP_TYPING_TIME_MIN_MS;
  }

  const estimated = Math.round(length * WHATSAPP_TYPING_MS_PER_CHAR);
  return Math.min(
    WHATSAPP_TYPING_TIME_MAX_MS,
    Math.max(WHATSAPP_TYPING_TIME_MIN_MS, estimated),
  );
}
