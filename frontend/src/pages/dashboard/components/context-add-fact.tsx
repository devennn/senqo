import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { InlineHelpHint } from "@/components/ui/inline-help-hint";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CONTEXT_ENTRIES_MAX_PER_GROUP } from "@/lib/context-groups-limits";
import { api } from "@/lib/api";

const TITLE_MAX = 200;
const BODY_MAX = 8000;

type Props = {
  groupId: string;
  atCapacity: boolean;
  onAdded: () => Promise<void>;
  onWorkspaceStale: () => void | Promise<void>;
};

export function ContextAddFact({ groupId, atCapacity, onAdded, onWorkspaceStale }: Props) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTitle("");
    setBodyText("");
    setError(null);
  }, [open]);

  const trimmedTitle = title.trim();
  const trimmedBody = bodyText.trim();
  const canSubmit = trimmedTitle.length > 0 && trimmedBody.length > 0 && !busy && !atCapacity;

  function handleDialogOpenChange(next: boolean) {
    if (!next && busy) return;
    setOpen(next);
  }

  async function handleAddEntry() {
    setBusy(true);
    setError(null);
    try {
      await api.post(`/api/user/workspace-context-groups/${groupId}/entries`, {
        title,
        bodyText,
      });
      setOpen(false);
      await Promise.resolve(onWorkspaceStale());
      await onAdded();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add entry.");
    } finally {
      setBusy(false);
    }
  }

  const titleId = `ctx-dialog-new-title-${groupId}`;
  const bodyId = `ctx-dialog-new-body-${groupId}`;

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 pt-2">
        <Button type="button" size="sm" disabled={atCapacity} onClick={() => setOpen(true)}>
          Add entry
        </Button>
        {atCapacity ? (
          <span className="text-sm text-destructive">
            This group is at its entry limit ({CONTEXT_ENTRIES_MAX_PER_GROUP}).
          </span>
        ) : null}
      </div>

      <Dialog open={open} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="sm:max-w-3xl" showCloseButton>
          <DialogHeader>
            <DialogTitle className="flex flex-wrap items-center gap-x-2 gap-y-1 pr-8">
              <span>New fact entry</span>
              <InlineHelpHint label="Adding a context entry">
                <p>
                  Short title plus factual body text for this group. You can edit or reorder later from the list (expand a row).
                </p>
              </InlineHelpHint>
            </DialogTitle>
            <DialogDescription>Add a title and facts; saves as one entry in this group.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor={titleId} className="text-xs">
                Title
              </Label>
              <Input
                id={titleId}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={TITLE_MAX}
                placeholder="Short label"
                disabled={busy}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={bodyId} className="text-xs">
                Facts
              </Label>
              <Textarea
                id={bodyId}
                value={bodyText}
                onChange={(e) => setBodyText(e.target.value)}
                maxLength={BODY_MAX}
                rows={5}
                className="font-mono text-sm"
                placeholder="Stable facts for this title."
                disabled={busy}
              />
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <div className="flex flex-wrap justify-end gap-2 pt-2">
              <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="button" size="sm" disabled={!canSubmit} onClick={() => void handleAddEntry()}>
                {busy ? "Adding…" : "Add entry"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
