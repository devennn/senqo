import { storageCreateSignedUrl, storageParseSignedUrlKey } from "../lib/storage.js";
import type { MediaStorageBucket, StoredMediaRef } from "../types/agent-multimodal.js";

const scope = "AgentHistoryMedia";

/** Plain signed-URL lifetime for replayed attachments (matches inbound media). */
const HISTORY_MEDIA_SIGNED_URL_SECONDS = 60 * 60;

const MEDIA_BUCKETS: readonly MediaStorageBucket[] = ["whatsapp-media", "agent-assets"];

function asMediaBucket(value: unknown): MediaStorageBucket | null {
  return typeof value === "string" && (MEDIA_BUCKETS as readonly string[]).includes(value)
    ? (value as MediaStorageBucket)
    : null;
}

function parseMediaRefPart(part: Record<string, unknown>): StoredMediaRef | null {
  const media = part.media;
  if (!media || typeof media !== "object") return null;
  const raw = media as Record<string, unknown>;
  const bucket = asMediaBucket(raw.bucket);
  const path = typeof raw.path === "string" ? raw.path.trim() : "";
  if (!bucket || !path) return null;
  return { bucket, path };
}

function readImageUrl(part: Record<string, unknown>): string | null {
  const imageUrl = part.image_url;
  if (!imageUrl || typeof imageUrl !== "object") return null;
  const url = (imageUrl as Record<string, unknown>).url;
  return typeof url === "string" && url.trim().length > 0 ? url : null;
}

function signMediaRef(ref: StoredMediaRef): Promise<string | null> {
  return storageCreateSignedUrl(ref.bucket, ref.path, HISTORY_MEDIA_SIGNED_URL_SECONDS);
}

/**
 * Resolves an agent-message content payload for the model call:
 *
 * - `media_ref` parts are signed into fresh `image_url` parts;
 * - legacy `image_url` parts holding a signed URL this backend minted are
 *   re-signed, so expired signatures can never fail a replayed run;
 * - data URLs (thumbnails) and unrecognized URLs pass through;
 * - parts that cannot be resolved are dropped so one missing attachment cannot
 *   take down the whole run.
 */
export async function resolveHistoryMediaForModel(content: unknown): Promise<unknown> {
  if (!Array.isArray(content)) return content;

  const resolved: unknown[] = [];
  for (const item of content) {
    if (!item || typeof item !== "object") {
      resolved.push(item);
      continue;
    }

    const part = item as Record<string, unknown>;

    if (part.type === "media_ref") {
      const ref = parseMediaRefPart(part);
      const url = ref ? await signMediaRef(ref) : null;
      if (!url) {
        console.warn(`[${scope}] Dropped media_ref part: could not sign stored media`);
        continue;
      }
      resolved.push({ type: "image_url", image_url: { url } });
      continue;
    }

    if (part.type === "image_url") {
      const url = readImageUrl(part);
      if (!url || url.startsWith("data:")) {
        resolved.push(item);
        continue;
      }
      const parsed = storageParseSignedUrlKey(url);
      const bucket = parsed ? asMediaBucket(parsed.bucketName) : null;
      if (!parsed || !bucket) {
        // Not a storage URL this backend minted (or an unknown bucket): keep it.
        resolved.push(item);
        continue;
      }
      const freshUrl = await signMediaRef({ bucket, path: parsed.key });
      if (!freshUrl) {
        console.warn(`[${scope}] Dropped image_url part: could not re-sign legacy signed URL`);
        continue;
      }
      resolved.push({ ...part, image_url: { ...(part.image_url as object), url: freshUrl } });
      continue;
    }

    resolved.push(item);
  }
  return resolved;
}
