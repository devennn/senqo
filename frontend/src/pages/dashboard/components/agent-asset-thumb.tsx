import type { LucideIcon } from "lucide-react";
import {
  File,
  FileArchive,
  FileAudio,
  FileSpreadsheet,
  FileText,
  FileVideo,
  Presentation,
} from "lucide-react";

type Props = {
  mimeType: string;
  previewUrl: string | null | undefined;
  fileName: string;
};

function iconForMime(mimeType: string): LucideIcon {
  const mime = mimeType.trim().toLowerCase();
  if (mime.startsWith("video/")) return FileVideo;
  if (mime.startsWith("audio/")) return FileAudio;
  if (mime === "application/pdf") return File;
  if (mime === "application/zip") return FileArchive;
  if (
    mime === "text/csv" ||
    mime === "application/vnd.ms-excel" ||
    mime === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  ) {
    return FileSpreadsheet;
  }
  if (
    mime === "application/vnd.ms-powerpoint" ||
    mime === "application/vnd.openxmlformats-officedocument.presentationml.presentation"
  ) {
    return Presentation;
  }
  return FileText;
}

export function AgentAssetThumb({ mimeType, previewUrl, fileName }: Props) {
  const isImage = mimeType.startsWith("image/");
  if (isImage && previewUrl) {
    return (
      <img
        src={previewUrl}
        alt=""
        className="size-20 shrink-0 rounded-md border border-border object-cover"
      />
    );
  }

  const Icon = iconForMime(mimeType);
  return (
    <div
      className="flex size-20 shrink-0 items-center justify-center rounded-md border border-border bg-muted"
      aria-label={`${fileName} file type`}
    >
      <Icon className="size-8 text-muted-foreground" aria-hidden />
    </div>
  );
}
