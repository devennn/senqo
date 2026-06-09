import { Download, FileText } from "lucide-react";
import type { ConversationMessageMedia } from "@/types/repositories";

function truncateFileName(fileName: string, maxBase: number): string {
  const trimmed = fileName.trim();
  if (trimmed.length <= maxBase) return trimmed;
  const ext = trimmed.lastIndexOf(".");
  if (ext <= 0 || ext === trimmed.length - 1) return `${trimmed.slice(0, maxBase)}...`;
  const extension = trimmed.slice(ext);
  const base = trimmed.slice(0, ext);
  const allowed = Math.max(8, maxBase - extension.length - 3);
  return base.length <= allowed ? trimmed : `${base.slice(0, allowed)}...${extension}`;
}

export function MessageMedia({ media }: { media: ConversationMessageMedia }) {
  const url = media.signedUrl || media.sourceUrl || null;
  const mime = media.mimeType ?? "";
  const fileName = media.fileName || "attachment";
  const displayName = truncateFileName(fileName, 36);

  if (!url) {
    return <div className="mt-2 rounded-xl border border-border/70 bg-background/70 px-3 py-2 text-xs text-muted-foreground">Attachment saved but preview unavailable.</div>;
  }
  if (mime.startsWith("image/")) {
    return <a href={url} target="_blank" rel="noreferrer" className="mt-2 block"><img src={url} alt={media.caption || fileName} className="max-h-72 w-full rounded-xl border border-border/70 object-contain" /></a>;
  }
  if (mime.startsWith("video/")) {
    return <video controls preload="metadata" src={url} className="mt-2 max-h-72 w-full rounded-xl border border-border/70" />;
  }
  if (mime.startsWith("audio/")) {
    return (
      <div className="w-[min(19rem,70vw)] rounded-xl border border-border/70 bg-background/80 p-2">
        <audio controls preload="metadata" src={url} className="block w-full" />
      </div>
    );
  }
  return (
    <a href={url} target="_blank" rel="noreferrer" className="mt-2 flex items-center gap-3 rounded-xl border border-border/70 bg-background/80 px-3 py-2 hover:bg-background">
      {media.thumbnailDataUrl
        ? <img src={media.thumbnailDataUrl} alt={fileName} className="size-12 shrink-0 rounded-md border border-border/70 object-cover" />
        : <div className="flex size-12 shrink-0 items-center justify-center rounded-md border border-border/70 bg-muted/50"><FileText className="size-4 text-muted-foreground" /></div>}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium" title={fileName}>{displayName}</p>
        <p className="text-xs text-muted-foreground">Open attachment</p>
      </div>
      <Download className="size-4 shrink-0 text-muted-foreground" />
    </a>
  );
}
