import { useEffect, useState } from "react";
import { FileText, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ConversationAttachmentKind } from "@/types/repositories";

export function MessageComposerAttachmentPreview({
  file,
  kind,
  disabled = false,
  onRemove,
}: {
  file: File;
  kind: ConversationAttachmentKind;
  disabled?: boolean;
  onRemove: () => void;
}) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (kind !== "image" && kind !== "audio") {
      setPreviewUrl(null);
      return;
    }

    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file, kind]);

  return (
    <div className="rounded-xl border border-border/70 bg-muted/30 p-2">
      <div className="flex items-center gap-3">
        {kind === "audio" && previewUrl ? (
          <audio controls preload="metadata" src={previewUrl} className="min-w-0 flex-1" />
        ) : previewUrl ? (
          <img
            src={previewUrl}
            alt={file.name}
            className="size-20 shrink-0 rounded-lg border border-border/70 object-cover"
          />
        ) : (
          <div className="flex size-12 shrink-0 items-center justify-center rounded-lg border border-border/70 bg-background">
            <FileText className="size-5 text-muted-foreground" />
          </div>
        )}
        {kind !== "audio" ? (
          <div className="flex min-w-0 flex-1 items-center">
            <p className="truncate text-sm font-medium" title={file.name}>
              {file.name || "attachment"}
            </p>
          </div>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 shrink-0 text-muted-foreground"
          aria-label="Remove attachment"
          disabled={disabled}
          onClick={onRemove}
        >
          <X className="size-4" />
        </Button>
      </div>
    </div>
  );
}
