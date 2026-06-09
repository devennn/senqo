/** Keep in sync with backend `workspace-asset-limits.ts`. */
export type WorkspaceAssetKind = "image" | "video" | "audio" | "file";

const MB = 1024 * 1024;

export const WORKSPACE_ASSET_MAX_BYTES_BY_KIND: Record<WorkspaceAssetKind, number> = {
  image: 10 * MB,
  video: 16 * MB,
  audio: 12 * MB,
  file: 20 * MB,
};

const ALLOWED_MIME_EXACT = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/csv",
  "application/zip",
]);

const ALLOWED_MIME_PREFIXES = ["image/", "video/", "audio/"];

export function classifyWorkspaceAssetKind(mimeType: string): WorkspaceAssetKind {
  const normalized = mimeType.trim().toLowerCase();
  if (normalized.startsWith("image/")) return "image";
  if (normalized.startsWith("video/")) return "video";
  if (normalized.startsWith("audio/")) return "audio";
  return "file";
}

function isAllowedWorkspaceAssetMimeType(mimeType: string): boolean {
  const normalized = mimeType.trim().toLowerCase();
  if (!normalized || normalized === "application/octet-stream") return true;
  if (ALLOWED_MIME_EXACT.has(normalized)) return true;
  return ALLOWED_MIME_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

function formatMegabytes(bytes: number): string {
  const mb = bytes / MB;
  return Number.isInteger(mb) ? String(mb) : mb.toFixed(1);
}

export function validateWorkspaceAssetFile(file: File): { ok: true } | { ok: false; message: string } {
  const kind = classifyWorkspaceAssetKind(file.type || "application/octet-stream");
  const maxBytes = WORKSPACE_ASSET_MAX_BYTES_BY_KIND[kind];
  if (!isAllowedWorkspaceAssetMimeType(file.type)) {
    return {
      ok: false,
      message: "File type is not allowed. Use images, video, audio, PDF, Office documents, text, or ZIP.",
    };
  }
  if (file.size <= 0) {
    return { ok: false, message: "File is empty." };
  }
  if (file.size > maxBytes) {
    const kindLabel =
      kind === "image" ? "Images" : kind === "video" ? "Videos" : kind === "audio" ? "Audio" : "Files";
    return {
      ok: false,
      message: `${kindLabel} must be ${formatMegabytes(maxBytes)} MB or smaller.`,
    };
  }
  return { ok: true };
}

export function workspaceAssetLimitsSummaryForUi(): string {
  return [
    `Images up to ${formatMegabytes(WORKSPACE_ASSET_MAX_BYTES_BY_KIND.image)} MB`,
    `videos up to ${formatMegabytes(WORKSPACE_ASSET_MAX_BYTES_BY_KIND.video)} MB`,
    `audio up to ${formatMegabytes(WORKSPACE_ASSET_MAX_BYTES_BY_KIND.audio)} MB`,
    `other files up to ${formatMegabytes(WORKSPACE_ASSET_MAX_BYTES_BY_KIND.file)} MB`,
  ].join("; ");
}
