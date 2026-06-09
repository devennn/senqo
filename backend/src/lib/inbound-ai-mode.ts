import type { ConversationHandlingMode, WhatsappConnectionMode } from "../types/repositories.js";

export function normalizeWhatsappConnectionMode(raw: string | null | undefined): WhatsappConnectionMode {
  if (raw === "testing" || raw === "live") return raw;
  return "inactive";
}

/** Per-thread composer: whether connection settings allow AI automation for this contact. */
export function connectionAiEnabledForComposer(
  mode: WhatsappConnectionMode,
  isTestContact: boolean
): boolean {
  if (mode === "inactive") return false;
  if (mode === "live") return true;
  return isTestContact;
}
