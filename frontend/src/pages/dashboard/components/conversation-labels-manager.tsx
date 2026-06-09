import { useCallback, useEffect, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageLoader } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { ConversationLabelRow } from "@/pages/dashboard/components/conversation-label-row";
import { ConversationLabelCreateDialog } from "@/pages/dashboard/components/conversation-label-create-dialog";
import { ConfirmDestructiveDialog } from "@/pages/dashboard/components/confirm-destructive-dialog";
import type { ConversationLabelRecord } from "@/types/repositories";

export function ConversationLabelsManager() {
  const [labels, setLabels] = useState<ConversationLabelRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);

  const reload = useCallback(async () => {
    const res = await api.get<{ labels: ConversationLabelRecord[] }>("/api/user/conversation-labels");
    setLabels(res.labels);
  }, []);

  useEffect(() => {
    setLoading(true);
    void reload().finally(() => setLoading(false));
  }, [reload]);

  async function handleCreate(name: string, description: string) {
    await api.post("/api/user/conversation-labels", { name, description });
    await reload();
  }

  async function handleUpdate(id: string, name: string, description: string) {
    await api.patch(`/api/user/conversation-labels/${id}`, { name, description });
    await reload();
  }

  async function handleDelete(id: string) {
    await api.delete(`/api/user/conversation-labels/${id}`);
    await reload();
  }

  if (loading) return <PageLoader label="Loading labels" />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold">Your labels</h2>
        <Button type="button" size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="mr-1.5 size-4" />
          Add label
        </Button>
      </div>

      <div className="space-y-3 md:hidden">
        {labels.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border/70 px-4 py-8 text-center text-muted-foreground">No labels</p>
        ) : (
          labels.map((l) => <ConversationLabelCard key={l.id} label={l} onUpdate={handleUpdate} onDelete={handleDelete} />)
        )}
      </div>

      <div className="card-surface hidden overflow-x-auto md:block">
        <table className="w-full min-w-[32rem] text-sm">
          <thead>
            <tr className="border-b border-border/60 bg-muted/40 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-3 font-semibold">Name</th>
              <th className="px-4 py-3 font-semibold">Description</th>
              <th className="w-24 px-4 py-3 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {labels.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-10 text-center text-muted-foreground">
                  No labels
                </td>
              </tr>
            ) : (
              labels.map((l) => <ConversationLabelRow key={l.id} label={l} onUpdate={handleUpdate} onDelete={handleDelete} />)
            )}
          </tbody>
        </table>
      </div>

      <ConversationLabelCreateDialog open={createOpen} onOpenChange={setCreateOpen} onCreate={handleCreate} />
    </div>
  );
}

function ConversationLabelCard({
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
      <article className="space-y-3 card-surface p-4">
        <Input value={name} onChange={(e) => setName(e.target.value)} aria-label="Label name" />
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="resize-none text-sm"
          aria-label="Description"
        />
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="button" size="sm" className="w-full sm:w-auto" disabled={busy || !name.trim()} onClick={() => void handleSave()}>
            Save
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full sm:w-auto"
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
      </article>
    );
  }

  return (
    <>
      <article className="card-surface p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="break-words font-semibold">{label.name || "—"}</h3>
            <p className="mt-2 break-words text-sm text-muted-foreground">
              {label.description?.trim() ? label.description : "No label"}
            </p>
          </div>
          <div className="flex shrink-0 gap-1">
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
        </div>
      </article>
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
