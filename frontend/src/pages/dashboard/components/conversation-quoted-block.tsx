import { FileText, Mic, Video } from "lucide-react";
import type { ConversationQuotedPreview } from "@/types/repositories";
import { cn } from "@/lib/utils";

function QuotedMediaIcon({ preview }: { preview: ConversationQuotedPreview }) {
  const iconClass = "size-4 text-muted-foreground";
  if (preview.mediaKind === "audio") return <Mic className={iconClass} />;
  if (preview.mediaKind === "video") return <Video className={iconClass} />;
  return <FileText className={iconClass} />;
}

function QuotedMediaThumb({ preview }: { preview: ConversationQuotedPreview }) {
  if (preview.thumbnailDataUrl) {
    return (
      <img
        src={preview.thumbnailDataUrl}
        alt=""
        className="size-11 shrink-0 rounded-md border border-border/60 object-cover"
      />
    );
  }
  if (!preview.mediaKind) return null;
  return (
    <div className="flex size-11 shrink-0 items-center justify-center rounded-md border border-border/60 bg-muted/40">
      <QuotedMediaIcon preview={preview} />
    </div>
  );
}

export function ConversationQuotedBlock({
  preview,
  className,
  onNavigate,
}: {
  preview: ConversationQuotedPreview;
  className?: string;
  onNavigate?: () => void;
}) {
  const showThumb = Boolean(preview.thumbnailDataUrl || preview.mediaKind);
  const bodyText = preview.bodyText?.trim() || "";
  const isNavigable = Boolean(onNavigate);

  const content = (
    <>
      <p className="text-[0.68rem] font-semibold uppercase tracking-wide text-muted-foreground/90">
        {preview.senderLabel}
      </p>
      <div className={cn("mt-1", showThumb && "flex gap-2.5")}>
        {showThumb ? <QuotedMediaThumb preview={preview} /> : null}
        {bodyText ? (
          <p className="min-w-0 flex-1 line-clamp-3 whitespace-pre-wrap break-words text-xs text-muted-foreground">
            {bodyText}
          </p>
        ) : null}
      </div>
    </>
  );

  if (isNavigable) {
    return (
      <button
        type="button"
        onClick={onNavigate}
        className={cn(
          "mb-0 w-full cursor-pointer rounded-lg border-l-[3px] px-3 py-2 text-left transition-colors hover:bg-black/[0.04] active:bg-black/[0.06]",
          className,
        )}
      >
        {content}
      </button>
    );
  }

  return <div className={cn("rounded-lg border-l-[3px] px-3 py-2", className)}>{content}</div>;
}
