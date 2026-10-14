import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GoogleDriveFileIcon } from "@/components/icons/google-drive-file-icon";
import {
  getCachedDriveItems,
  useWorkspaceApps,
  type DriveFileListItem,
} from "@/hooks/useWorkspaceApps";
import { googleDriveOpenUrl } from "@/lib/google-drive-open-url";
import { cn } from "@/lib/utils";
import { ExternalLink } from "lucide-react";

type Props = {
  open: boolean;
  selected: DriveFileListItem | null;
  driveConnected: boolean;
  accessLabel?: string;
  disabled?: boolean;
  onSelect: (file: DriveFileListItem) => void;
};

/** Search + picker for a Drive file to live-link as a doc asset. */
export function AssetDriveFilePicker({
  open,
  selected,
  driveConnected,
  accessLabel,
  disabled = false,
  onSelect,
}: Props) {
  const { workspaceId = "" } = useParams<{ workspaceId: string }>();
  const { listDriveItems } = useWorkspaceApps();
  const [query, setQuery] = useState("");
  const [files, setFiles] = useState<DriveFileListItem[]>([]);
  const [listing, setListing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !driveConnected) return;
    const opts = { purpose: "browse" as const, kind: "file" as const, q: query };
    const cached = getCachedDriveItems(opts);
    if (cached) {
      setFiles(cached);
      setListing(false);
      return;
    }
    let cancelled = false;
    setListing(true);
    void listDriveItems(opts)
      .then((next) => {
        if (!cancelled) setFiles(next);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not list Drive files");
        }
      })
      .finally(() => {
        if (!cancelled) setListing(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, driveConnected, query, listDriveItems]);

  if (!driveConnected) {
    return (
      <p className="text-sm text-muted-foreground">
        Connect Google Drive in{" "}
        <Link className="underline" to={`/${workspaceId}/connect?tab=apps`}>
          Connect → Apps
        </Link>{" "}
        first.
      </p>
    );
  }

  return (
    <div className="min-w-0 space-y-2">
      <Label htmlFor="asset-drive-search">
        Search Drive{accessLabel ? ` (${accessLabel})` : ""}
      </Label>
      <Input
        id="asset-drive-search"
        className="w-full max-w-full"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="File name"
        disabled={disabled}
      />
      <div className="max-h-48 min-w-0 overflow-y-auto rounded-md border border-border">
        {error ? (
          <p className="p-3 text-sm text-destructive">{error}</p>
        ) : listing ? (
          <p className="p-3 text-sm text-muted-foreground">Loading…</p>
        ) : files.length === 0 ? (
          <p className="p-3 text-sm text-muted-foreground">No files found</p>
        ) : (
          <ul className="divide-y divide-border">
            {files.map((item) => {
              const isSelected = selected?.id === item.id;
              const openUrl = googleDriveOpenUrl(item.id, item.mimeType);
              return (
                <li key={item.id} className="min-w-0">
                  <div
                    className={cn(
                      "flex w-full min-w-0 items-center gap-2 px-3 py-2 text-sm",
                      isSelected ? "bg-secondary" : "hover:bg-muted/60",
                    )}
                  >
                    <button
                      type="button"
                      disabled={disabled}
                      className="flex min-w-0 flex-1 items-center gap-2 text-left"
                      onClick={() => onSelect(item)}
                    >
                      <GoogleDriveFileIcon mimeType={item.mimeType} className="size-4" />
                      <span className="min-w-0 truncate">{item.name}</span>
                    </button>
                    {openUrl ? (
                      <a
                        href={openUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Open ${item.name}`}
                        className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-background hover:text-foreground"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ExternalLink className="size-3.5" />
                      </a>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
