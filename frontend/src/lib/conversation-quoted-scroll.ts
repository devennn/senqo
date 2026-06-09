import type { ConversationMessage } from "@/types/repositories";

const CONVERSATION_MESSAGE_DOM_ID_PREFIX = "conversation-message-";

export function conversationMessageDomId(messageId: string): string {
  return `${CONVERSATION_MESSAGE_DOM_ID_PREFIX}${messageId}`;
}

/** Maps WhatsApp message ids (stanzaId) → conversation row id. */
export function buildWhatsappExternalMessageIdLookup(
  messages: ConversationMessage[],
): Map<string, string> {
  const map = new Map<string, string>();
  for (const message of messages) {
    const metadata =
      message.metadata && typeof message.metadata === "object"
        ? (message.metadata as Record<string, unknown>)
        : null;
    if (!metadata) continue;
    const webhookMessageId =
      typeof metadata.webhookMessageId === "string" ? metadata.webhookMessageId.trim() : "";
    const whatsappMessageId =
      typeof metadata.whatsappMessageId === "string"
        ? metadata.whatsappMessageId.trim()
        : typeof metadata.greenMessageId === "string"
          ? metadata.greenMessageId.trim()
          : "";
    if (webhookMessageId) map.set(webhookMessageId, message.id);
    if (whatsappMessageId) map.set(whatsappMessageId, message.id);
  }
  return map;
}

export function scrollToConversationMessage(messageId: string): boolean {
  const element = document.getElementById(conversationMessageDomId(messageId));
  if (!element) return false;
  element.scrollIntoView({ behavior: "smooth", block: "center" });
  return true;
}
