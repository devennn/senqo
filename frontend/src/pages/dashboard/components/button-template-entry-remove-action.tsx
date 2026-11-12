import { useState } from "react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { ConfirmDestructiveDialog } from "@/components/confirm-destructive-dialog";

type Props = {
  groupId: string;
  entryId: string;
  disabled: boolean;
  onAfterMutation: () => Promise<void>;
  onWorkspaceStale: () => void | Promise<void>;
};

/** Remove button + confirm dialog for one saved button template. */
export function ButtonTemplateEntryRemoveAction({
  groupId,
  entryId,
  disabled,
  onAfterMutation,
  onWorkspaceStale,
}: Props) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [removing, setRemoving] = useState(false);

  async function handleConfirmRemove() {
    setRemoving(true);
    try {
      await api.delete(`/api/user/button-template-groups/${groupId}/entries/${entryId}`);
      await Promise.resolve(onWorkspaceStale());
      await onAfterMutation();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not remove template.";
      throw new Error(msg);
    } finally {
      setRemoving(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled || removing}
        onClick={() => setDialogOpen(true)}
      >
        Remove
      </Button>
      <ConfirmDestructiveDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title="Remove this template from the group?"
        confirmLabel="Remove"
        pendingConfirmLabel="Removing…"
        isConfirming={removing}
        onConfirm={handleConfirmRemove}
      />
    </>
  );
}
