import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { buttonTemplateButtonsEqual } from "@/lib/button-template-buttons";
import { ButtonTemplateEntryCardExpanded } from "@/pages/dashboard/components/button-template-entry-card-expanded";
import { ButtonTemplateEntryRemoveAction } from "@/pages/dashboard/components/button-template-entry-remove-action";
import type { ButtonTemplateButton, WorkspaceButtonTemplateEntryRecord } from "@/types/repositories";

type Props = {
  groupId: string;
  entry: WorkspaceButtonTemplateEntryRecord;
  labelIndex: number;
  onAfterMutation: () => Promise<void>;
  onWorkspaceStale: () => void | Promise<void>;
  focusOpen?: boolean;
};

export function ButtonTemplateEntryCard({
  groupId,
  entry,
  labelIndex,
  onAfterMutation,
  onWorkspaceStale,
  focusOpen = false,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(focusOpen);
  const [title, setTitle] = useState(entry.title);
  const [body, setBody] = useState(entry.body);
  const [buttons, setButtons] = useState<ButtonTemplateButton[]>(entry.buttons);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    setTitle(entry.title);
    setBody(entry.body);
    setButtons(entry.buttons);
    setSaveError(null);
  }, [entry]);

  useEffect(() => {
    if (!focusOpen) return;
    setExpanded(true);
    const el = rootRef.current;
    if (!el) return;
    const timerId = window.setTimeout(() => {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 50);
    return () => window.clearTimeout(timerId);
  }, [focusOpen]);

  useEffect(() => {
    if (!saveError) return;
    setExpanded(true);
  }, [saveError]);

  const isDirty = useMemo(
    () =>
      title.trim() !== entry.title.trim() ||
      body.trim() !== entry.body.trim() ||
      !buttonTemplateButtonsEqual(buttons, entry.buttons),
    [body, buttons, entry, title],
  );

  const panelId = `btp-entry-panel-${entry.id}`;
  const triggerId = `btp-entry-trigger-${entry.id}`;

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    try {
      await api.patch(`/api/user/button-template-groups/${groupId}/entries/${entry.id}`, {
        title,
        body,
        buttons,
      });
      await onAfterMutation();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Could not save template.");
    } finally {
      setSaving(false);
    }
  }

  /** Discard unsaved edits and close the editor. */
  function handleCancel() {
    setTitle(entry.title);
    setBody(entry.body);
    setButtons(entry.buttons);
    setSaveError(null);
    setExpanded(false);
  }

  return (
    <div
      ref={rootRef}
      className={cn(
        "rounded-lg border bg-muted/20",
        focusOpen ? "border-primary ring-2 ring-primary/25" : "border-border/60",
      )}
    >
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
            {title.trim() ? title.trim() : "Untitled template"}
          </span>
          {isDirty ? (
            <span className="shrink-0 text-xs font-medium text-amber-600 dark:text-amber-500">Unsaved</span>
          ) : null}
        </button>
        <ButtonTemplateEntryRemoveAction
          groupId={groupId}
          entryId={entry.id}
          disabled={saving}
          onAfterMutation={onAfterMutation}
          onWorkspaceStale={onWorkspaceStale}
        />
      </div>
      {expanded ? (
        <ButtonTemplateEntryCardExpanded
          idPrefix={`btp-entry-${entry.id}`}
          panelId={panelId}
          labelledBy={triggerId}
          title={title}
          body={body}
          buttons={buttons}
          onChangeTitle={setTitle}
          onChangeBody={setBody}
          onChangeButtons={setButtons}
          saving={saving}
          saveError={saveError}
          isDirty={isDirty}
          onSave={() => void handleSave()}
          onCancel={handleCancel}
        />
      ) : null}
    </div>
  );
}
