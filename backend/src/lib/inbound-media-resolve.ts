import {
  isInboundImageMimeType,
  type InboundMediaRaw,
  type ResolvedInboundMedia,
} from "./inbound-media-to-model-parts.js";
import { signWhatsappMediaPathForInboundAi } from "../repositories/conversations.js";

export async function resolveInboundMediaSigned(
  workspaceId: string,
  mediaDescriptors: InboundMediaRaw[],
): Promise<ResolvedInboundMedia[]> {
  const resolvedList: ResolvedInboundMedia[] = [];
  for (const raw of mediaDescriptors) {
    let url: string | null = null;
    if (raw.storagePath) {
      url = await signWhatsappMediaPathForInboundAi(workspaceId, raw.storagePath);
    }
    const imageLike = isInboundImageMimeType(raw.mimeType);
    if (!url && imageLike && raw.thumbnailDataUrl) {
      url = raw.thumbnailDataUrl;
    }
    if (!url) continue;
    resolvedList.push({ url, mimeType: raw.mimeType, fileName: raw.fileName });
  }
  return resolvedList;
}
