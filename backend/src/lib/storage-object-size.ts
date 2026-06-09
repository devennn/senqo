/** Bytes stored on a Supabase storage.objects row (metadata.size or metadata.contentLength). */
export function storageObjectSizeBytes(metadata: unknown): number {
  if (!metadata || typeof metadata !== "object") return 0;
  const record = metadata as Record<string, unknown>;
  const raw = record.size ?? record.contentLength;
  const parsed = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}
