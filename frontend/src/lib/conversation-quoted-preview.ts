import type { ConversationMessage, ConversationQuotedPreview, ConversationQuotedPreviewMediaKind } from "@/types/repositories";

function digitsFromWhatsappChatIdLocalPart(chatId: string): string {
  return (chatId.split("@")[0] ?? "").replace(/\D/g, "");
}

/** Key for matching WhatsApp JIDs that may differ by device suffix or host. */
export function whatsappParticipantLookupKey(chatId: string | null | undefined): string | null {
  const raw = chatId?.trim();
  if (!raw) return null;
  const digits = digitsFromWhatsappChatIdLocalPart(raw);
  if (digits.length >= 8) return digits;
  return raw.toLowerCase();
}

export function whatsappChatIdsLikelySameAccount(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  const ta = a?.trim();
  const tb = b?.trim();
  if (!ta || !tb) return false;
  if (ta === tb) return true;
  const ka = whatsappParticipantLookupKey(ta);
  const kb = whatsappParticipantLookupKey(tb);
  return Boolean(ka && kb && ka === kb);
}

/**
 * Maps normalized WhatsApp sender id → best display label from inbound user messages in the thread.
 */
export function buildWhatsappInboundParticipantDisplayLookup(
  messages: ConversationMessage[],
): Map<string, string> {
  const map = new Map<string, string>();
  for (const m of messages) {
    if (m.role !== "user") continue;
    const jid = m.whatsapp_sender_chat_id?.trim();
    if (!jid) continue;
    const key = whatsappParticipantLookupKey(jid);
    if (!key) continue;
    if (map.has(key)) continue;
    const local = jid.split("@")[0]?.trim() || jid;
    const label = m.whatsapp_sender_name?.trim() || local;
    map.set(key, label);
  }
  return map;
}

function quotedMediaKind(
  typeMessage: string,
  mimeType: string,
): ConversationQuotedPreviewMediaKind | null {
  if (mimeType.startsWith("image/") || typeMessage === "imageMessage") return "image";
  if (mimeType.startsWith("video/") || typeMessage === "videoMessage") return "video";
  if (mimeType.startsWith("audio/") || typeMessage === "audioMessage") return "audio";
  if (typeMessage === "documentMessage" || mimeType.startsWith("application/")) return "document";
  return null;
}

function mediaFallbackLabel(kind: ConversationQuotedPreviewMediaKind, fileName: string): string {
  if (kind === "image") return "Photo";
  if (kind === "video") return "Video";
  if (kind === "audio") return "Audio";
  return fileName.trim() || "Document";
}

export function getQuotedPreview(
  message: ConversationMessage,
  inboundParticipantDisplayByLookupKey: Map<string, string>,
  whatsappExternalIdToMessageId: Map<string, string>,
): ConversationQuotedPreview | null {
  const metadata =
    message.metadata && typeof message.metadata === "object"
      ? (message.metadata as Record<string, unknown>)
      : null;
  const quoted = metadata?.quoted;
  if (!quoted || typeof quoted !== "object") return null;
  const q = quoted as Record<string, unknown>;

  const typeMessage = typeof q.type === "string" ? q.type.trim() : "";
  const mimeType = typeof q.mimeType === "string" ? q.mimeType.trim() : "";
  const fileName = typeof q.fileName === "string" ? q.fileName.trim() : "";
  const storedText = typeof q.text === "string" ? q.text.trim() : "";
  const thumbnailDataUrl =
    typeof q.thumbnailDataUrl === "string" && q.thumbnailDataUrl.trim().length > 0
      ? q.thumbnailDataUrl.trim()
      : null;
  const mediaKind = quotedMediaKind(typeMessage, mimeType);

  if (!storedText && !thumbnailDataUrl && !mediaKind) return null;

  const bodyText =
    storedText ||
    (mediaKind && !thumbnailDataUrl ? mediaFallbackLabel(mediaKind, fileName) : null);

  const quotedParticipant = typeof q.participant === "string" ? q.participant.trim() : "";
  const receiverChatId =
    typeof metadata?.receiverChatId === "string" ? metadata.receiverChatId.trim() : "";

  let senderLabel: string;
  if (
    quotedParticipant &&
    receiverChatId &&
    whatsappChatIdsLikelySameAccount(quotedParticipant, receiverChatId)
  ) {
    senderLabel = "You";
  } else if (quotedParticipant) {
    const lookupKey = whatsappParticipantLookupKey(quotedParticipant);
    const fromThread = lookupKey ? inboundParticipantDisplayByLookupKey.get(lookupKey) : undefined;
    if (fromThread) {
      senderLabel = fromThread;
    } else {
      const local = quotedParticipant.split("@")[0]?.trim();
      senderLabel = local || "Quoted message";
    }
  } else {
    senderLabel = "Quoted message";
  }

  const stanzaId = typeof q.stanzaId === "string" ? q.stanzaId.trim() : "";
  const targetMessageId = stanzaId
    ? (whatsappExternalIdToMessageId.get(stanzaId) ?? null)
    : null;

  return { senderLabel, bodyText, thumbnailDataUrl, mediaKind, targetMessageId };
}
