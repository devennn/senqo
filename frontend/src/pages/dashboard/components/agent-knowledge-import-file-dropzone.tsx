import { useRef, useState } from "react";
import { FileText, Plus, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  AGENT_KNOWLEDGE_IMPORT_ACCEPT,
  AGENT_KNOWLEDGE_IMPORT_FILE_TYPES_LABEL,
  AGENT_KNOWLEDGE_IMPORT_MAX_FILES,
} from "@/lib/agent-knowledge-import";
import type { AgentKnowledgeImportFile } from "@/types/agent-knowledge-import";

type Props = {
  files: AgentKnowledgeImportFile[];
  fileError: string | null;
  disabled?: boolean;
  onAddFiles: (files: FileList | File[]) => void;
  onRemoveFile: (id: string) => void;
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AgentKnowledgeImportFileDropzone({
  files,
  fileError,
  disabled,
  onAddFiles,
  onRemoveFile,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState<false | "compact" | "empty">(false);
  const hasFiles = files.length > 0;
  const atMax = files.length >= AGENT_KNOWLEDGE_IMPORT_MAX_FILES;

  function openPicker() {
    if (!disabled) inputRef.current?.click();
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (disabled || atMax) return;
    onAddFiles(e.dataTransfer.files);
  }

  function bindDragHandlers(compact: boolean) {
    return {
      onDragOver: (e: React.DragEvent) => {
        e.preventDefault();
        if (!disabled && !atMax) setDragOver(compact ? "compact" : "empty");
      },
      onDragLeave: () => setDragOver(false),
      onDrop: handleDrop,
    };
  }

  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={AGENT_KNOWLEDGE_IMPORT_ACCEPT}
        className="sr-only"
        disabled={disabled || atMax}
        onChange={(e) => {
          if (e.target.files) onAddFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {hasFiles ? (
        <>
          <ul className="space-y-2">
            {files.map((entry) => (
              <li
                key={entry.id}
                className="flex items-center gap-3 rounded-lg border border-border/70 bg-card px-3 py-2 text-sm shadow-soft"
              >
                <FileText className="size-4 shrink-0 text-primary" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{entry.file.name}</p>
                  <p className="text-xs text-muted-foreground">{formatBytes(entry.file.size)}</p>
                </div>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  aria-label={`Remove ${entry.file.name}`}
                  disabled={disabled}
                  onClick={() => onRemoveFile(entry.id)}
                >
                  <X className="size-4" aria-hidden />
                </Button>
              </li>
            ))}
          </ul>

          {atMax ? (
            <p className="text-xs text-muted-foreground">
              {AGENT_KNOWLEDGE_IMPORT_MAX_FILES} files added — remove one to upload another.
            </p>
          ) : (
            <div
              {...bindDragHandlers(true)}
              className={cn(
                "flex items-center justify-between gap-3 rounded-lg border border-dashed px-3 py-2 transition-colors",
                dragOver === "compact"
                  ? "border-primary bg-primary/5"
                  : "border-border/70 bg-secondary/20",
                disabled && "pointer-events-none opacity-60",
              )}
            >
              <p className="text-xs text-muted-foreground">Drop more files here</p>
              <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={openPicker}>
                <Plus className="size-3.5" aria-hidden />
                Add files
              </Button>
            </div>
          )}
        </>
      ) : (
        <div
          role="button"
          tabIndex={disabled ? -1 : 0}
          onKeyDown={(e) => {
            if (disabled) return;
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              openPicker();
            }
          }}
          {...bindDragHandlers(false)}
          onClick={openPicker}
          className={cn(
            "flex min-h-40 cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border border-dashed px-4 py-8 text-center transition-colors",
            dragOver === "empty"
              ? "border-primary bg-primary/5"
              : "border-border/80 bg-secondary/30 hover:border-primary/50",
            disabled && "pointer-events-none opacity-60",
          )}
        >
          <span className="flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Upload className="size-5" aria-hidden />
          </span>
          <div>
            <p className="text-sm font-medium text-foreground">Drop company docs here</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {AGENT_KNOWLEDGE_IMPORT_FILE_TYPES_LABEL} — up to {AGENT_KNOWLEDGE_IMPORT_MAX_FILES} files
            </p>
          </div>
          <Button type="button" size="sm" variant="outline" disabled={disabled}>
            Browse files
          </Button>
        </div>
      )}

      {fileError ? <p className="text-sm text-destructive">{fileError}</p> : null}
    </div>
  );
}
