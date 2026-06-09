import { useEffect, useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { ConfirmDestructiveDialog } from "@/pages/dashboard/components/confirm-destructive-dialog";
import { HandoffTopicGroupEntryForm } from "@/pages/dashboard/components/handoff-topic-group-entry-form";
import { cn } from "@/lib/utils";
import type { WorkspaceHandoffTopicEntryRecord } from "@/types/repositories";

type Props = {
  groupId: string;
  entry: WorkspaceHandoffTopicEntryRecord;
  labelIndex: number;
  onAfterMutation: () => Promise<void>;
  onWorkspaceStale: () => void | Promise<void>;
};

export function HandoffTopicGroupEntryCard({
  groupId,
  entry,
  labelIndex,
  onAfterMutation,
  onWorkspaceStale,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [topic, setTopic] = useState(entry.topic);
  const [description, setDescription] = useState(entry.description);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);

  useEffect(() => {
    setTopic(entry.topic);
    setDescription(entry.description);
    setSaveError(null);
  }, [entry.id, entry.topic, entry.description]);

  useEffect(() => {
    if (!saveError) return;
    setExpanded(true);
  }, [saveError]);

  const isDirty = useMemo(() => {
    return topic.trim() !== entry.topic.trim() || description.trim() !== entry.description.trim();
  }, [description, entry.description, entry.topic, topic]);

  const panelId = `ho-entry-panel-${entry.id}`;
  const triggerId = `ho-entry-trigger-${entry.id}`;

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    try {
      await api.patch(`/api/user/handoff-topic-groups/${groupId}/entries/${entry.id}`, {
        topic,
        description,
      });
      await onAfterMutation();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Could not save topic.");
    } finally {
      setSaving(false);
    }
  }

  async function handleConfirmRemove() {
    setSaving(true);
    setSaveError(null);
    try {
      await api.delete(`/api/user/handoff-topic-groups/${groupId}/entries/${entry.id}`);
      onWorkspaceStale();
      await onAfterMutation();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not remove topic.";
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
            Topic {labelIndex}
          </span>
          <span className="min-w-0 flex-1 text-sm leading-snug text-foreground line-clamp-2">
            {topic.trim() ? topic.trim() : "Empty topic"}
          </span>
          {isDirty ? (
            <span className="shrink-0 text-xs font-medium text-amber-600 dark:text-amber-500">Unsaved</span>
          ) : null}
        </button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0"
          disabled={saving}
          onClick={() => setRemoveDialogOpen(true)}
        >
          Remove
        </Button>
      </div>
      <ConfirmDestructiveDialog
        open={removeDialogOpen}
        onOpenChange={setRemoveDialogOpen}
        title="Remove this topic from the group?"
        confirmLabel="Remove"
        pendingConfirmLabel="Removing…"
        isConfirming={saving}
        onConfirm={handleConfirmRemove}
      />
      {expanded ? (
        <HandoffTopicGroupEntryForm
          panelId={panelId}
          labelledBy={triggerId}
          topic={topic}
          description={description}
          saving={saving}
          saveError={saveError}
          isDirty={isDirty}
          onTopicChange={setTopic}
          onDescriptionChange={setDescription}
          onSave={() => void handleSave()}
        />
      ) : null}
    </div>
  );
}
