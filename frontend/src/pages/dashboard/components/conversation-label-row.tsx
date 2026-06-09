import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDestructiveDialog } from "@/pages/dashboard/components/confirm-destructive-dialog";
import type { ConversationLabelRecord } from "@/types/repositories";

export function ConversationLabelRow({
  label,
  onUpdate,
  onDelete,
}: {
  label: ConversationLabelRecord;
  onUpdate: (id: string, name: string, description: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(label.name);
  const [description, setDescription] = useState(label.description);
  const [busy, setBusy] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  async function handleSave() {
    setBusy(true);
    try {
      await onUpdate(label.id, name.trim(), description);
      setEditing(false);
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirmDelete() {
    setBusy(true);
    try {
      await onDelete(label.id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not delete label.";
      throw new Error(msg);
    } finally {
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <tr className="border-b border-border/50">
        <td className="px-4 py-3 align-middle" colSpan={3}>
          <div className="space-y-2">
            <Input value={name} onChange={(e) => setName(e.target.value)} aria-label="Label name" />
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="resize-none text-sm"
              aria-label="Description"
            />
            <div className="flex gap-2">
              <Button type="button" size="sm" disabled={busy || !name.trim()} onClick={() => void handleSave()}>
                Save
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => {
                  setName(label.name);
                  setDescription(label.description);
                  setEditing(false);
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <>
      <tr className="border-b border-border/50">
        <td className="max-w-[12rem] px-4 py-3 align-middle">
          <div className="break-words font-medium">{label.name || "—"}</div>
        </td>
        <td className="min-w-0 px-4 py-3 align-middle">
          <div className="break-words text-sm text-muted-foreground">
            {label.description?.trim() ? label.description : "No label"}
          </div>
        </td>
        <td className="w-24 px-4 py-3 text-right align-middle">
          <div className="flex justify-end gap-1">
            <Button type="button" variant="ghost" size="icon" className="size-8" disabled={busy} onClick={() => setEditing(true)}>
              <Pencil className="size-4" />
              <span className="sr-only">Edit</span>
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="icon"
              className="size-8"
              disabled={busy}
              onClick={() => setDeleteDialogOpen(true)}
            >
              <Trash2 className="size-4" />
              <span className="sr-only">Delete</span>
            </Button>
          </div>
        </td>
      </tr>
      <ConfirmDestructiveDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title={`Delete label "${label.name}"?`}
        description="Assignments will be removed."
        confirmLabel="Delete"
        pendingConfirmLabel="Deleting…"
        isConfirming={busy}
        onConfirm={handleConfirmDelete}
      />
    </>
  );
}
