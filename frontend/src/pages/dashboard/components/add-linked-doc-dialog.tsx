import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { GoogleDriveFileIcon } from "@/components/icons/google-drive-file-icon";
import { GoogleDriveIcon } from "@/components/icons/google-drive-icon";
import {
  getCachedDriveItems,
  useLinkedDocs,
  useWorkspaceApps,
  type DriveFileListItem,
} from "@/hooks/useWorkspaceApps";
import { googleDriveOpenUrl } from "@/lib/google-drive-open-url";
import { cn } from "@/lib/utils";
import { ExternalLink, Loader2, Upload } from "lucide-react";

type SourceMode = "upload" | "google_drive";

type Props = {
  onCreated?: () => void;
};

export function AddLinkedDocDialog({ onCreated }: Props) {
  const { workspaceId = "" } = useParams<{ workspaceId: string }>();
  const {
    createUploadDoc,
    createDriveDoc,
    listDriveFiles,
    summarizeUploadFile,
    summarizeDriveFile,
  } = useLinkedDocs();
  const { apps } = useWorkspaceApps();
  const driveApp = apps.find((a) => a.toolkit === "googledrive");
  const driveConnected = driveApp?.status === "active";
  const driveAccessLabel = driveApp?.accessLabel;

  const [open, setOpen] = useState(false);
  const [source, setSource] = useState<SourceMode>("upload");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [driveQuery, setDriveQuery] = useState("");
  const [driveFiles, setDriveFiles] = useState<DriveFileListItem[]>([]);
  const [selectedDrive, setSelectedDrive] = useState<DriveFileListItem | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const [summarizing, setSummarizing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listing, setListing] = useState(false);
  const summarizeGen = useRef(0);

  const descriptionOk = description.trim().length > 0;
  const canSave =
    descriptionOk &&
    !busy &&
    !summarizing &&
    (source === "upload" ? Boolean(file) : Boolean(selectedDrive));

  useEffect(() => {
    if (!open || source !== "google_drive" || !driveConnected) return;
    const opts = { purpose: "browse" as const, kind: "file" as const, q: driveQuery };
    const cached = getCachedDriveItems(opts);
    if (cached) {
      setDriveFiles(cached);
      setListing(false);
      return;
    }
    let cancelled = false;
    setListing(true);
    void listDriveFiles(driveQuery)
      .then((files) => {
        if (!cancelled) setDriveFiles(files);
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
  }, [open, source, driveConnected, driveQuery, listDriveFiles]);

  async function runSummarizeUpload(next: File) {
    const gen = ++summarizeGen.current;
    setSummarizing(true);
    setError(null);
    try {
      const text = await summarizeUploadFile(next);
      if (gen !== summarizeGen.current) return;
      setDescription(text);
    } catch (err) {
      if (gen !== summarizeGen.current) return;
      setError(
        err instanceof Error ? err.message : "Could not summarize file",
      );
    } finally {
      if (gen === summarizeGen.current) setSummarizing(false);
    }
  }

  async function runSummarizeDrive(item: DriveFileListItem) {
    const gen = ++summarizeGen.current;
    setSummarizing(true);
    setError(null);
    try {
      const text = await summarizeDriveFile({
        driveFileId: item.id,
        fileName: item.name,
        mimeType: item.mimeType,
      });
      if (gen !== summarizeGen.current) return;
      setDescription(text);
    } catch (err) {
      if (gen !== summarizeGen.current) return;
      setError(
        err instanceof Error ? err.message : "Could not summarize file",
      );
    } finally {
      if (gen === summarizeGen.current) setSummarizing(false);
    }
  }

  async function handleSave() {
    if (!canSave) return;
    setBusy(true);
    setError(null);
    try {
      if (source === "upload" && file) {
        await createUploadDoc(file, description.trim());
      } else if (source === "google_drive" && selectedDrive) {
        await createDriveDoc({
          driveFileId: selectedDrive.id,
          fileName: selectedDrive.name,
          mimeType: selectedDrive.mimeType,
          description: description.trim(),
        });
      }
      setOpen(false);
      setDescription("");
      setFile(null);
      setSelectedDrive(null);
      setDriveQuery("");
      onCreated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save doc");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          summarizeGen.current += 1;
          setError(null);
          setBusy(false);
          setSummarizing(false);
        }
      }}
    >
      <DialogTrigger render={<Button type="button" size="sm" />}>
        Add docs
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] w-full gap-0 overflow-hidden p-0 sm:max-w-lg">
        <div className="min-w-0 space-y-4 overflow-y-auto p-4">
          <DialogHeader>
            <DialogTitle>Add docs</DialogTitle>
            <DialogDescription>
              One file only. After you pick a file, AI drafts a short description
              the agent uses (you can edit it). Directories are not allowed.
            </DialogDescription>
          </DialogHeader>

          <div
            role="tablist"
            aria-label="Doc source"
            className="grid grid-cols-2 gap-1 rounded-lg border border-border bg-muted/40 p-1"
          >
            <SourceTab
              selected={source === "upload"}
              onClick={() => {
                setSource("upload");
                setSelectedDrive(null);
                setError(null);
              }}
            >
              <Upload className="size-3.5" />
              Upload
            </SourceTab>
            <SourceTab
              selected={source === "google_drive"}
              onClick={() => {
                setSource("google_drive");
                setFile(null);
                setError(null);
              }}
            >
              <GoogleDriveIcon className="size-3.5" />
              Google Drive
            </SourceTab>
          </div>

          {source === "upload" ? (
            <div className="min-w-0 space-y-2">
              <Label htmlFor="linked-doc-file">File</Label>
              <Input
                id="linked-doc-file"
                type="file"
                className="w-full max-w-full"
                accept=".pdf,.csv,.doc,.docx,.xls,.xlsx,.txt,.md"
                onChange={(e) => {
                  const next = e.target.files?.[0] ?? null;
                  setFile(next);
                  if (next) void runSummarizeUpload(next);
                  else setDescription("");
                }}
              />
            </div>
          ) : !driveConnected ? (
            <p className="text-sm text-muted-foreground">
              Connect Google Drive in{" "}
              <Link
                className="underline"
                to={`/${workspaceId}/connect?tab=apps`}
              >
                Connect → Apps
              </Link>{" "}
              first.
            </p>
          ) : (
            <div className="min-w-0 space-y-2">
              <Label htmlFor="drive-search">
                Search Drive{driveAccessLabel ? ` (${driveAccessLabel})` : ""}
              </Label>
              <Input
                id="drive-search"
                className="w-full max-w-full"
                value={driveQuery}
                onChange={(e) => setDriveQuery(e.target.value)}
                placeholder="File name"
              />
              <div className="max-h-48 min-w-0 overflow-y-auto rounded-md border border-border">
                {listing ? (
                  <p className="p-3 text-sm text-muted-foreground">Loading…</p>
                ) : driveFiles.length === 0 ? (
                  <p className="p-3 text-sm text-muted-foreground">No files found</p>
                ) : (
                  <ul className="divide-y divide-border">
                    {driveFiles.map((item) => {
                      const selected = selectedDrive?.id === item.id;
                      const openUrl = googleDriveOpenUrl(item.id, item.mimeType);
                      return (
                        <li key={item.id} className="min-w-0">
                          <div
                            className={cn(
                              "flex w-full min-w-0 items-center gap-2 px-3 py-2 text-sm",
                              selected
                                ? "bg-secondary"
                                : "hover:bg-muted/60",
                            )}
                          >
                            <button
                              type="button"
                              disabled={summarizing}
                              className="flex min-w-0 flex-1 items-center gap-2 text-left"
                              onClick={() => {
                                setSelectedDrive(item);
                                void runSummarizeDrive(item);
                              }}
                            >
                              <GoogleDriveFileIcon
                                mimeType={item.mimeType}
                                className="size-4"
                              />
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
          )}

          <div className="min-w-0 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="linked-doc-description">What is this file about?</Label>
              {summarizing && (
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <Loader2 className="size-3.5 animate-spin" />
                  Writing description…
                </span>
              )}
            </div>
            <Textarea
              id="linked-doc-description"
              className="w-full max-w-full"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              disabled={summarizing}
              placeholder="Pick a file — AI drafts a short agent-facing description"
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter className="mx-0 mb-0 rounded-none">
          <Button
            type="button"
            variant="outline"
            disabled={busy || summarizing}
            onClick={() => setOpen(false)}
          >
            Cancel
          </Button>
          <Button type="button" disabled={!canSave} onClick={() => void handleSave()}>
            {busy ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SourceTab(props: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={props.selected}
      onClick={props.onClick}
      className={cn(
        "inline-flex h-9 items-center justify-center gap-1.5 rounded-md px-2 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50",
        props.selected
          ? "bg-background font-semibold text-foreground shadow-soft"
          : "font-medium text-muted-foreground hover:text-foreground",
      )}
    >
      {props.children}
    </button>
  );
}
