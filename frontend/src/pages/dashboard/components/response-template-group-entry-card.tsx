import { useEffect, useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { ConfirmDestructiveDialog } from "@/pages/dashboard/components/confirm-destructive-dialog";
import { ResponseTemplateGroupEntryCardExpanded } from "@/pages/dashboard/components/response-template-group-entry-card-expanded";
import type { WorkspaceResponseTemplateEntryRecord } from "@/types/repositories";

type Props = {
  groupId: string;
  entry: WorkspaceResponseTemplateEntryRecord;
  labelIndex: number;
  onAfterMutation: () => Promise<void>;
  onWorkspaceStale: () => void | Promise<void>;
};

export function ResponseTemplateGroupEntryCard({
  groupId,
  entry,
  labelIndex,
  onAfterMutation,
  onWorkspaceStale,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [questionText, setQuestionText] = useState(entry.question_text);
  const [answerText, setAnswerText] = useState(entry.answer_text);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);

  useEffect(() => {
    setQuestionText(entry.question_text);
    setAnswerText(entry.answer_text);
    setSaveError(null);
  }, [entry.id, entry.question_text, entry.answer_text]);

  useEffect(() => {
    if (!saveError) return;
    setExpanded(true);
  }, [saveError]);

  const isDirty = useMemo(() => {
    return (
      questionText.trim() !== entry.question_text.trim() || answerText.trim() !== entry.answer_text.trim()
    );
  }, [answerText, entry.answer_text, entry.question_text, questionText]);

  const panelId = `rtp-entry-panel-${entry.id}`;
  const triggerId = `rtp-entry-trigger-${entry.id}`;

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    try {
      await api.patch(`/api/user/response-template-groups/${groupId}/entries/${entry.id}`, {
        questionText,
        answerText,
      });
      await onAfterMutation();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Could not save template.");
    } finally {
      setSaving(false);
    }
  }

  async function handleConfirmRemove() {
    setSaving(true);
    setSaveError(null);
    try {
      await api.delete(`/api/user/response-template-groups/${groupId}/entries/${entry.id}`);
      onWorkspaceStale();
      await onAfterMutation();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not remove template.";
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
            Template {labelIndex}
          </span>
          <span className="min-w-0 flex-1 text-sm leading-snug text-foreground line-clamp-2">
            {questionText.trim() ? questionText.trim() : "Empty question"}
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
        title="Remove this entry from the group?"
        confirmLabel="Remove"
        pendingConfirmLabel="Removing…"
        isConfirming={saving}
        onConfirm={handleConfirmRemove}
      />
      {expanded ? (
        <ResponseTemplateGroupEntryCardExpanded
          entryId={entry.id}
          panelId={panelId}
          labelledBy={triggerId}
          questionText={questionText}
          answerText={answerText}
          onQuestionChange={setQuestionText}
          onAnswerChange={setAnswerText}
          saving={saving}
          saveError={saveError}
          isDirty={isDirty}
          onSave={() => void handleSave()}
        />
      ) : null}
    </div>
  );
}
