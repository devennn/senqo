export type WhatsappWebhookQuotedMessage = {
  typeMessage?: string;
  textMessage?: string;
  textMessageData?: { textMessage?: string };
  caption?: string;
  fileName?: string;
  mimeType?: string;
  jpegThumbnail?: string;
  participant?: string;
  stanzaId?: string;
};

function thumbnailMimeForDataUrl(mimeType: string): string {
  const normalized = mimeType.trim().toLowerCase();
  if (normalized.startsWith("image/")) return normalized;
  return "image/jpeg";
}

function buildThumbnailDataUrl(jpegThumbnail: string, mimeType: string): string {
  const trimmed = jpegThumbnail.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("data:")) return trimmed;
  const imageMime = thumbnailMimeForDataUrl(mimeType);
  return `data:${imageMime};base64,${trimmed}`;
}

/** Builds `metadata.quoted` for inbound `quotedMessage` webhooks (text + media replies). */
export function buildWhatsappQuotedMetadata(
  quotedMessage: WhatsappWebhookQuotedMessage | undefined,
): Record<string, unknown> | null {
  if (!quotedMessage) return null;

  const typeMessage = quotedMessage.typeMessage?.trim() || "textMessage";
  const mimeType = quotedMessage.mimeType?.trim() || "";
  const fileName = quotedMessage.fileName?.trim() || "";
  const caption = quotedMessage.caption?.trim() || "";
  const textBody =
    quotedMessage.textMessage?.trim() ||
    quotedMessage.textMessageData?.textMessage?.trim() ||
    caption ||
    (typeMessage === "documentMessage" ? fileName : "") ||
    "";

  const isMediaType = !["textMessage", "extendedTextMessage"].includes(typeMessage);
  const jpegThumbnail = quotedMessage.jpegThumbnail?.trim() || "";
  const thumbnailDataUrl = jpegThumbnail
    ? buildThumbnailDataUrl(jpegThumbnail, mimeType)
    : null;
  const hasMedia = isMediaType || Boolean(thumbnailDataUrl) || mimeType.length > 0;

  if (!textBody && !hasMedia) return null;

  return {
    text: textBody,
    type: typeMessage,
    stanzaId: quotedMessage.stanzaId ?? null,
    participant: quotedMessage.participant ?? null,
    ...(mimeType ? { mimeType } : {}),
    ...(fileName ? { fileName } : {}),
    ...(thumbnailDataUrl ? { thumbnailDataUrl } : {}),
  };
}
