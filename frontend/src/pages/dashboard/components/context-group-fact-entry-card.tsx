import { useEffect, useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { ConfirmDestructiveDialog } from "@/pages/dashboard/components/confirm-destructive-dialog";
import { ContextGroupFactEntryCardExpanded } from "@/pages/dashboard/components/context-group-fact-entry-card-expanded";
import type { WorkspaceContextEntryRecord } from "@/types/repositories";

type Props = {
  groupId: string;
  entry: WorkspaceContextEntryRecord;
  labelIndex: number;
  onAfterMutation: () => Promise<void>;
  onWorkspaceStale: () => void | Promise<void>;
};

export function ContextGroupFactEntryCard({
  groupId,
  entry,
  labelIndex,
  onAfterMutation,
  onWorkspaceStale,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [title, setTitle] = useState(entry.title);
  const [bodyText, setBodyText] = useState(entry.body_text);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);

  useEffect(() => {
    setTitle(entry.title);
    setBodyText(entry.body_text);
    setSaveError(null);
  }, [entry.id, entry.title, entry.body_text]);

  useEffect(() => {
    if (!saveError) return;
    setExpanded(true);
  }, [saveError]);

  const isDirty = useMemo(() => {
    return title.trim() !== entry.title.trim() || bodyText.trim() !== entry.body_text.trim();
  }, [bodyText, entry.body_text, entry.title, title]);

  const panelId = `ctx-entry-panel-${entry.id}`;
  const triggerId = `ctx-entry-trigger-${entry.id}`;

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    try {
      await api.patch(`/api/user/workspace-context-groups/${groupId}/entries/${entry.id}`, {
        title,
        bodyText,
      });
      await onAfterMutation();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  }

  async function handleConfirmRemove() {
    setSaving(true);
    setSaveError(null);
    try {
      await api.delete(`/api/user/workspace-context-groups/${groupId}/entries/${entry.id}`);
      onWorkspaceStale();
      await onAfterMutation();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not remove.";
      throw new Error(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-lg border border-border/60 bg-muted/20">
      <div className="flex items-center gap-2 px-3 py-2">
        <button
          type="button"
          id={triggerId}
          aria-expanded={expanded}
          aria-controls={panelId}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-1 py-0.5 text-left outline-none ring-offset-background hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => setExpanded((open) => !open)}
        >
          <ChevronDown
            className={cn(
              "size-4 shrink-0 text-muted-foreground transition-transform duration-200",
              expanded && "rotate-180",
            )}
            aria-hidden
          />
          <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Fact {labelIndex}
          </span>
          <span className="min-w-0 flex-1 text-sm leading-snug text-foreground line-clamp-2">
            {title.trim() ? title.trim() : "Untitled"}
          </span>
          {isDirty ? (
            <span className="shrink-0 text-xs font-medium text-amber-600 dark:text-amber-500">Unsaved</span>
          ) : null}
        </button>
        <Button type="button" variant="outline" size="sm" className="shrink-0" disabled={saving} onClick={() => setRemoveDialogOpen(true)}>
          Remove
        </Button>
      </div>
      <ConfirmDestructiveDialog
        open={removeDialogOpen}
        onOpenChange={setRemoveDialogOpen}
        title="Remove this fact entry?"
        confirmLabel="Remove"
        pendingConfirmLabel="Removing…"
        isConfirming={saving}
        onConfirm={handleConfirmRemove}
      />
      {expanded ? (
        <ContextGroupFactEntryCardExpanded
          entryId={entry.id}
          panelId={panelId}
          labelledBy={triggerId}
          title={title}
          bodyText={bodyText}
          onTitleChange={setTitle}
          onBodyChange={setBodyText}
          saving={saving}
          saveError={saveError}
          isDirty={isDirty}
          onSave={() => void handleSave()}
        />
      ) : null}
    </div>
  );
}
