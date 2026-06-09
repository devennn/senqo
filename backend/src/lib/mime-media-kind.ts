/** Map MIME type to WhatsApp outbound media kind used by Green API sends. */
export function mediaKindFromMimeType(mimeType: string): "image" | "audio" | "file" {
  const normalized = mimeType.trim().toLowerCase();
  if (normalized.startsWith("image/")) return "image";
  if (normalized.startsWith("audio/")) return "audio";
  return "file";
}
