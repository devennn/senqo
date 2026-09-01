/** Keep in sync with backend `workspace-asset-limits.ts`. */

const MB = 1024 * 1024;

export const WORKSPACE_ASSET_MAX_BYTES = 20 * MB;

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
  if (!isAllowedWorkspaceAssetMimeType(file.type)) {
    return {
      ok: false,
      message: "File type is not allowed. Use images, video, audio, PDF, Office documents, text, or ZIP.",
    };
  }
  if (file.size <= 0) {
    return { ok: false, message: "File is empty." };
  }
  if (file.size > WORKSPACE_ASSET_MAX_BYTES) {
    return {
      ok: false,
      message: `File must be ${formatMegabytes(WORKSPACE_ASSET_MAX_BYTES)} MB or smaller.`,
    };
  }
  return { ok: true };
}

export function workspaceAssetLimitsSummaryForUi(): string {
  return `Up to ${formatMegabytes(WORKSPACE_ASSET_MAX_BYTES)} MB per file`;
}
