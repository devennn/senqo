const EXTENSION_TO_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  bmp: "image/bmp",
  ico: "image/x-icon",
  heic: "image/heic",
  heif: "image/heif",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  m4a: "audio/mp4",
  ogg: "audio/ogg",
  opus: "audio/opus",
  flac: "audio/flac",
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  pdf: "application/pdf",
  zip: "application/zip",
  txt: "text/plain",
  csv: "text/csv",
  json: "application/json",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};

/** Guess display name, MIME, and kind for a public URL used by scheduled-task file sends. */
export function describePublicUrlAttachment(fileUrl: string): {
  fileName: string;
  mimeType: string;
  mediaKind: "image" | "audio" | "file";
} {
  let fileName = "attachment";
  try {
    const u = new URL(fileUrl);
    const pathPart = u.pathname.split("/").filter(Boolean).pop() ?? "attachment";
    fileName = decodeURIComponent(pathPart.split("?")[0]).trim() || "attachment";
  } catch {
    // Caller validates URL before send; keep a safe default.
  }
  const ext = fileName.includes(".")
    ? fileName.slice(fileName.lastIndexOf(".") + 1).toLowerCase()
    : "";
  const mimeType = EXTENSION_TO_MIME[ext] ?? "application/octet-stream";
  const mediaKind: "image" | "audio" | "file" = mimeType.startsWith("image/")
    ? "image"
    : mimeType.startsWith("audio/")
      ? "audio"
      : "file";
  return { fileName, mimeType, mediaKind };
}
