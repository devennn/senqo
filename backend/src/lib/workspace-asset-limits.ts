export type WorkspaceAssetKind = "image" | "video" | "audio" | "file";

const MB = 1024 * 1024;

/** Per-file caps by kind (WhatsApp delivery and storage). */
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

export function maxBytesForWorkspaceAssetKind(kind: WorkspaceAssetKind): number {
  return WORKSPACE_ASSET_MAX_BYTES_BY_KIND[kind];
}

export function isAllowedWorkspaceAssetMimeType(mimeType: string): boolean {
  const normalized = mimeType.trim().toLowerCase();
  if (!normalized || normalized === "application/octet-stream") {
    return true;
  }
  if (ALLOWED_MIME_EXACT.has(normalized)) return true;
  return ALLOWED_MIME_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

export function formatMegabytes(bytes: number): string {
  const mb = bytes / MB;
  return Number.isInteger(mb) ? String(mb) : mb.toFixed(1);
}

export type ValidateWorkspaceAssetUploadInput = {
  fileName: string;
  mimeType: string;
  byteLength: number;
};

export type ValidateWorkspaceAssetUploadResult =
  | { ok: true; kind: WorkspaceAssetKind; maxBytes: number }
  | { ok: false; message: string };

export function validateWorkspaceAssetUpload(
  input: ValidateWorkspaceAssetUploadInput,
): ValidateWorkspaceAssetUploadResult {
  const fileName = input.fileName.trim();
  if (!fileName) {
    return { ok: false, message: "File name is required." };
  }

  const mimeType = input.mimeType.trim().toLowerCase() || "application/octet-stream";
  if (!isAllowedWorkspaceAssetMimeType(mimeType)) {
    return {
      ok: false,
      message:
        "File type is not allowed. Use images, video, audio, PDF, Office documents, text, or ZIP.",
    };
  }

  const kind = classifyWorkspaceAssetKind(mimeType);
  const maxBytes = maxBytesForWorkspaceAssetKind(kind);

  if (input.byteLength <= 0) {
    return { ok: false, message: "File is empty." };
  }

  if (input.byteLength > maxBytes) {
    const kindLabel =
      kind === "image"
        ? "Images"
        : kind === "video"
          ? "Videos"
          : kind === "audio"
            ? "Audio"
            : "Files";
    return {
      ok: false,
      message: `${kindLabel} must be ${formatMegabytes(maxBytes)} MB or smaller.`,
    };
  }

  return { ok: true, kind, maxBytes };
}

export function workspaceAssetLimitsSummaryForUi(): string {
  return [
    `Images up to ${formatMegabytes(WORKSPACE_ASSET_MAX_BYTES_BY_KIND.image)} MB`,
    `videos up to ${formatMegabytes(WORKSPACE_ASSET_MAX_BYTES_BY_KIND.video)} MB`,
    `audio up to ${formatMegabytes(WORKSPACE_ASSET_MAX_BYTES_BY_KIND.audio)} MB`,
    `other files up to ${formatMegabytes(WORKSPACE_ASSET_MAX_BYTES_BY_KIND.file)} MB`,
  ].join("; ");
}
