import type { ConversationHandlingMode, WhatsappConnectionMode } from "../types/repositories.js";

export function normalizeWhatsappConnectionMode(raw: string | null | undefined): WhatsappConnectionMode {
  if (raw === "testing" || raw === "dry_run" || raw === "live") return raw;
  return "inactive";
}

/** Per-thread composer: whether connection settings allow AI automation for this contact. */
export function connectionAiEnabledForComposer(
  mode: WhatsappConnectionMode,
  isTestContact: boolean
): boolean {
  if (mode === "inactive") return false;
  if (mode === "live" || mode === "dry_run") return true;
  return isTestContact;
}
