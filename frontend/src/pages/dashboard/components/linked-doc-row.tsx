import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { GoogleDriveFileIcon } from "@/components/icons/google-drive-file-icon";
import { GoogleDriveIcon } from "@/components/icons/google-drive-icon";
import type { LinkedDocListItem } from "@/hooks/useWorkspaceApps";
import { ExternalLink, Loader2, Sparkles, Upload } from "lucide-react";

type Props = {
  doc: LinkedDocListItem;
  editing: boolean;
  draft: string;
  busy: boolean;
  summarizing: boolean;
  onDraftChange: (value: string) => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSave: () => void;
  onDelete: () => void;
  onRegenerate: () => void;
};

export function LinkedDocRow({
  doc,
  editing,
  draft,
  busy,
  summarizing,
  onDraftChange,
  onStartEdit,
  onCancelEdit,
  onSave,
  onDelete,
  onRegenerate,
}: Props) {
  const openUrl = doc.open_url?.trim() || null;

  return (
    <li className="space-y-2 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex min-w-0 items-center gap-2 font-medium">
            <GoogleDriveFileIcon mimeType={doc.mime_type} className="size-4" />
            {openUrl ? (
              <a
                href={openUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-w-0 items-center gap-1.5 truncate text-foreground underline-offset-4 hover:underline"
              >
                <span className="min-w-0 truncate">{doc.file_name}</span>
                <ExternalLink className="size-3.5 shrink-0 text-muted-foreground" />
              </a>
            ) : (
              <span className="min-w-0 truncate">{doc.file_name}</span>
            )}
          </p>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            {doc.source === "google_drive" ? (
              <>
                <GoogleDriveIcon className="size-3.5" />
                Google Drive
              </>
            ) : (
              <>
                <Upload className="size-3.5" />
                Upload
              </>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy || summarizing}
            onClick={onStartEdit}
          >
            Edit
          </Button>
          <Button
            type="button"
            size="sm"
            variant="destructive"
            disabled={busy || summarizing}
            onClick={onDelete}
          >
            Delete
          </Button>
        </div>
      </div>
      {editing ? (
        <div className="space-y-2">
          <Textarea
            value={draft}
            onChange={(e) => onDraftChange(e.target.value)}
            rows={4}
            disabled={summarizing}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={summarizing || busy}
              onClick={onRegenerate}
            >
              {summarizing ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Sparkles className="size-3.5" />
              )}
              Regenerate
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={!draft.trim() || busy || summarizing}
              onClick={onSave}
            >
              Save
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={summarizing}
              onClick={onCancelEdit}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{doc.description}</p>
      )}
    </li>
  );
}
