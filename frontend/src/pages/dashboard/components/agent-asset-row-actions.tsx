import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDestructiveDialog } from "@/components/confirm-destructive-dialog";
import { Loader2, Sparkles } from "lucide-react";

type Props = {
  assetId: string;
  fileName: string;
  description: string;
  dirty: boolean;
  onSaveDescription: (assetId: string, description: string) => Promise<void>;
  /** Optional AI rewrite of the description; fills the draft for the operator to save. */
  onSummarize?: (assetId: string) => Promise<string>;
  onDelete: (assetId: string) => Promise<void>;
  /** Replaces the row's description draft, e.g. after an AI rewrite. */
  onDraftChange: (description: string) => void;
};

/** Save / Regenerate / Remove actions for one asset row, including remove confirmation. */
export function AgentAssetRowActions({
  assetId,
  fileName,
  description,
  dirty,
  onSaveDescription,
  onSummarize,
  onDelete,
  onDraftChange,
}: Props) {
  const [saving, setSaving] = useState(false);
  const [summarizing, setSummarizing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await onSaveDescription(assetId, description.trim());
    } finally {
      setSaving(false);
    }
  }

  async function handleRegenerate() {
    if (!onSummarize) return;
    setSummarizing(true);
    try {
      onDraftChange(await onSummarize(assetId));
    } finally {
      setSummarizing(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await onDelete(assetId);
      setConfirmOpen(false);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          disabled={!dirty || saving}
          onClick={() => {
            void handleSave();
          }}
        >
          {saving ? "Saving…" : "Save"}
        </Button>
        {onSummarize ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={saving || summarizing || deleting}
            onClick={() => {
              void handleRegenerate();
            }}
          >
            {summarizing ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Sparkles className="size-3.5" />
            )}
            Regenerate
          </Button>
        ) : null}
        <Button
          type="button"
          size="sm"
          variant="destructive"
          disabled={deleting}
          onClick={() => setConfirmOpen(true)}
        >
          {deleting ? "Removing…" : "Remove"}
        </Button>
      </div>
      <ConfirmDestructiveDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Remove asset?"
        description={`"${fileName}" will be removed from this group. This cannot be undone.`}
        confirmLabel="Remove"
        pendingConfirmLabel="Removing…"
        isConfirming={deleting}
        onConfirm={handleDelete}
      />
    </>
  );
}
