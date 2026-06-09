import { downloadMediaMessage, type proto, type WAMessage, type WASocket } from "baileys";
import { env } from "./env.js";
import { baileysLogger, logger } from "./logger.js";

/**
 * Unwrap Baileys "container" messages (ephemeral, view-once, document-with-caption)
 * down to the inner content message that actually carries the payload.
 */
export function unwrapMessage(
  message: proto.IMessage | null | undefined,
): proto.IMessage | null {
  let current = message ?? null;
  for (let i = 0; i < 5 && current; i++) {
    const next =
      current.ephemeralMessage?.message ??
      current.viewOnceMessage?.message ??
      current.viewOnceMessageV2?.message ??
      current.viewOnceMessageV2Extension?.message ??
      current.documentWithCaptionMessage?.message ??
      null;
    if (!next) break;
    current = next;
  }
  return current;
}

/**
 * Download (and decrypt) a media message into a base64 string. Returns `null` if the
 * payload is missing or exceeds the inline size cap. `reuploadRequest` lets Baileys
 * recover media whose servers asked for a re-upload.
 */
export async function downloadMediaBase64(
  sock: WASocket,
  fullMessage: proto.IWebMessageInfo,
): Promise<string | null> {
  if (!fullMessage.key) return null;
  const waMessage = fullMessage as WAMessage;
  try {
    const buffer = (await downloadMediaMessage(
      waMessage,
      "buffer",
      {},
      { logger: baileysLogger, reuploadRequest: sock.updateMediaMessage },
    )) as Buffer;
    if (!buffer || buffer.length === 0) return null;
    if (buffer.length > env.maxInlineMediaBytes) {
      logger.warn(
        { bytes: buffer.length, cap: env.maxInlineMediaBytes },
        "media exceeds inline cap; skipping download",
      );
      return null;
    }
    return buffer.toString("base64");
  } catch (error) {
    logger.error({ error: String(error) }, "media download failed");
    return null;
  }
}

/** JPEG thumbnail (base64, no data-url prefix) if the media carries one. */
export function thumbnailBase64(node: { jpegThumbnail?: Uint8Array | null } | null | undefined): string | undefined {
  const thumb = node?.jpegThumbnail;
  if (!thumb || thumb.length === 0) return undefined;
  return Buffer.from(thumb).toString("base64");
}
