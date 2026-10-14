import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAssetSummaryDraft } from "@/hooks/useAssetSummaryDraft";
import type { DriveFileListItem } from "@/hooks/useWorkspaceApps";
import { api } from "@/lib/api";
import {
  AssetAddKindFields,
  type AssetAddDocSource,
  type AssetAddKind,
} from "@/pages/dashboard/components/asset-add-kind-fields";
import { Loader2 } from "lucide-react";

type Props = {
  groupId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdded: () => Promise<void> | void;
};

/** Add a sendable file or a live doc (upload or Google Drive) to an asset group. */
export function AssetAddDialog({ groupId, open, onOpenChange, onAdded }: Props) {
  const [kind, setKind] = useState<AssetAddKind>("file");
  const [docSource, setDocSource] = useState<AssetAddDocSource>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [selectedDrive, setSelectedDrive] = useState<DriveFileListItem | null>(null);
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { summarizing, summarizeUpload, summarizeDrive } = useAssetSummaryDraft(groupId);
  const summarizeGen = useRef(0);

  const usesUpload = kind === "file" || docSource === "upload";
  const hasPick = usesUpload ? Boolean(file) : Boolean(selectedDrive);
  const canSave = description.trim().length > 0 && !busy && !summarizing && hasPick;

  function handleOpenChange(next: boolean) {
    onOpenChange(next);
    if (next) return;
    summarizeGen.current += 1;
    setKind("file");
    setDocSource("upload");
    setFile(null);
    setSelectedDrive(null);
    setDescription("");
    setError(null);
    setBusy(false);
  }

  function handleKindChange(next: AssetAddKind) {
    if (next === kind) return;
    summarizeGen.current += 1;
    setKind(next);
    setFile(null);
    setSelectedDrive(null);
    setDescription("");
    setError(null);
  }

  function handleDocSourceChange(next: AssetAddDocSource) {
    if (next === docSource) return;
    summarizeGen.current += 1;
    setDocSource(next);
    setFile(null);
    setSelectedDrive(null);
    setDescription("");
    setError(null);
  }

  async function draftFromUpload(next: File) {
    const gen = ++summarizeGen.current;
    setError(null);
    try {
      const text = await summarizeUpload(next);
      if (gen !== summarizeGen.current) return;
      setDescription(text);
    } catch (err) {
      if (gen !== summarizeGen.current) return;
      setError(err instanceof Error ? err.message : "Could not summarize file");
    }
  }

  async function draftFromDrive(item: DriveFileListItem) {
    const gen = ++summarizeGen.current;
    setError(null);
    try {
      const text = await summarizeDrive(item);
      if (gen !== summarizeGen.current) return;
      setDescription(text);
    } catch (err) {
      if (gen !== summarizeGen.current) return;
      setError(err instanceof Error ? err.message : "Could not summarize file");
    }
  }

  async function handleSave() {
    if (!canSave) return;
    setBusy(true);
    setError(null);
    try {
      if (usesUpload) {
        if (!file) return;
        const form = new FormData();
        form.set("file", file);
        form.set("kind", kind);
        form.set("description", description.trim());
        await api.postForm(`/api/user/workspace-asset-groups/${groupId}/assets`, form);
      } else if (selectedDrive) {
        await api.post(`/api/user/workspace-asset-groups/${groupId}/assets/drive`, {
          source: "google_drive",
          driveFileId: selectedDrive.id,
          fileName: selectedDrive.name,
          mimeType: selectedDrive.mimeType,
          description: description.trim(),
        });
      }
      await onAdded();
      handleOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add asset");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[85vh] w-full gap-0 overflow-hidden p-0 sm:max-w-lg">
        <div className="min-w-0 space-y-4 overflow-y-auto p-4">
          <DialogHeader>
            <DialogTitle>Add asset</DialogTitle>
            <DialogDescription>
              Pick a file — AI drafts a short description the agent uses. You can edit it before
              saving.
            </DialogDescription>
          </DialogHeader>

          <AssetAddKindFields
            open={open}
            kind={kind}
            docSource={docSource}
            selectedDrive={selectedDrive}
            disabled={busy}
            onKindChange={handleKindChange}
            onDocSourceChange={handleDocSourceChange}
            onFileChange={(next) => {
              setFile(next);
              if (next) void draftFromUpload(next);
              else setDescription("");
            }}
            onDriveSelect={(item) => {
              setSelectedDrive(item);
              void draftFromDrive(item);
            }}
          />

          <div className="min-w-0 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="asset-add-description">What is this about?</Label>
              {summarizing ? (
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <Loader2 className="size-3.5 animate-spin" />
                  Writing description…
                </span>
              ) : null}
            </div>
            <Textarea
              id="asset-add-description"
              className="w-full max-w-full"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              disabled={busy || summarizing}
              placeholder="Pick a file — AI drafts a short agent-facing description"
            />
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>

        <DialogFooter className="mx-0 mb-0 rounded-none">
          <Button
            type="button"
            variant="outline"
            disabled={busy || summarizing}
            onClick={() => handleOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="button" disabled={!canSave} onClick={() => void handleSave()}>
            {busy ? "Adding…" : "Add"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
