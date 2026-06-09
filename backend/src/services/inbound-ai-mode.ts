import type { ConversationHandlingMode, WhatsappConnectionMode } from "../types/repositories.js";
import { normalizeWhatsappConnectionMode, connectionAiEnabledForComposer } from "../lib/inbound-ai-mode.js";

// Re-export so existing service consumers don't break
export { normalizeWhatsappConnectionMode, connectionAiEnabledForComposer };

/** Whether the inbound debounced agent run should execute model inference. */
export function shouldRunInboundAi(
  mode: WhatsappConnectionMode,
  isTestContact: boolean,
  handlingMode: ConversationHandlingMode
): boolean {
  if (handlingMode === "human") return false;
  if (mode === "inactive") return false;
  if (mode === "testing" && !isTestContact) return false;
  return true;
}
