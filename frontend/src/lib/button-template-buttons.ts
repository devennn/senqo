import type { ButtonTemplateButton } from "@/types/repositories";

/**
 * Derive a quick-reply id from the button label ("Yes please!" → "yes_please").
 * Returns an empty string when the label has no ASCII word characters, so
 * non-Latin labels never wipe a value the author typed.
 */
export function slugifyButtonReplyId(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/**
 * True while a quick-reply id should keep following the label: only when the
 * value is still empty or exactly what the label produced. Once the author
 * edits the value by hand, it stops syncing.
 */
export function shouldAutoFillReplyId(button: ButtonTemplateButton): boolean {
  if (button.type !== "quick_reply") return false;
  const value = button.value.trim();
  return value.length === 0 || value === slugifyButtonReplyId(button.label);
}

/** Compare saved vs edited buttons ignoring surrounding whitespace. */
export function buttonTemplateButtonsEqual(
  a: ButtonTemplateButton[],
  b: ButtonTemplateButton[],
): boolean {
  if (a.length !== b.length) return false;
  return a.every(
    (button, i) =>
      button.type === b[i].type &&
      button.label.trim() === b[i].label.trim() &&
      button.value.trim() === b[i].value.trim(),
  );
}
