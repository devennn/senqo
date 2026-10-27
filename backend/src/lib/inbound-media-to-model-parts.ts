import type {
  InboundUserMediaPart,
  MediaStorageBucket,
} from "../types/agent-multimodal.js";

/** Max image parts attached to one inbound AI run (cost + context). */
export const INBOUND_AI_MAX_MEDIA_PARTS = 5;

export type InboundMediaRaw = {
  storagePath: string | null;
  mimeType: string;
  fileName: string | null;
  thumbnailDataUrl: string | null;
};

/** Inbound AI only consumes image/* attachments; voice, video, documents, etc. are not modeled. */
export function isInboundImageMimeType(mimeType: string): boolean {
  return mimeType.trim().toLowerCase().startsWith("image/");
}

/**
 * Parse WhatsApp-stored media from a message row. Includes any stored file (path) so non-image
 * attachments can trigger human handoff upstream; only image/* parts are sent to the model.
 */
export function parseInboundMediaFromMetadata(
  metadata: Record<string, unknown> | null,
): InboundMediaRaw | null {
  if (!metadata || typeof metadata !== "object") return null;
  const media = metadata.media;
  if (!media || typeof media !== "object") return null;
  const raw = media as Record<string, unknown>;
  const path = typeof raw.path === "string" && raw.path.length > 0 ? raw.path : null;
  let mimeType =
    typeof raw.mimeType === "string" && raw.mimeType.trim().length > 0
      ? raw.mimeType.trim()
      : "application/octet-stream";
  const fileName =
    typeof raw.fileName === "string" && raw.fileName.length > 0 ? raw.fileName : null;
  const thumbnailDataUrl =
    typeof raw.thumbnailDataUrl === "string" && raw.thumbnailDataUrl.length > 0
      ? raw.thumbnailDataUrl
      : null;

  if (
    thumbnailDataUrl &&
    thumbnailDataUrl.startsWith("data:image/") &&
    !mimeType.toLowerCase().startsWith("image/") &&
    !path
  ) {
    mimeType = "image/jpeg";
  }

  const isImage = isInboundImageMimeType(mimeType);
  if (path) {
    return {
      storagePath: path,
      mimeType,
      fileName,
      thumbnailDataUrl,
    };
  }
  if (isImage && thumbnailDataUrl) {
    return {
      storagePath: null,
      mimeType,
      fileName,
      thumbnailDataUrl,
    };
  }
  return null;
}

export type ResolvedInboundMedia = {
  url: string;
  mimeType: string;
  fileName: string | null;
  /** Present when `url` is a signed URL for a stored object; absent for data-URL thumbnails. */
  storageBucket?: MediaStorageBucket | null;
  storagePath?: string | null;
};

/**
 * Builds inbound attachment parts from signed URLs / thumbnails (text is added
 * upstream). Storage-backed media keeps its coordinates so the transcript can
 * re-sign a fresh URL instead of persisting the expiring one.
 */
export function buildInboundUserMediaParts(
  resolved: ResolvedInboundMedia[],
): InboundUserMediaPart[] {
  const parts: InboundUserMediaPart[] = [];
  for (const r of resolved) {
    if (!isInboundImageMimeType(r.mimeType)) continue;
    const storageRef =
      r.storageBucket && r.storagePath
        ? { bucket: r.storageBucket, path: r.storagePath }
        : undefined;
    parts.push(storageRef ? { url: r.url, storageRef } : { url: r.url });
  }
  return parts;
}
