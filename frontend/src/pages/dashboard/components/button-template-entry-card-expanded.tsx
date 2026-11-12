import { Button } from "@/components/ui/button";
import { ButtonTemplateEntryFields } from "@/pages/dashboard/components/button-template-entry-fields";
import type { ButtonTemplateButton } from "@/types/repositories";

type Props = {
  idPrefix: string;
  panelId: string;
  labelledBy: string;
  title: string;
  body: string;
  buttons: ButtonTemplateButton[];
  onChangeTitle: (next: string) => void;
  onChangeBody: (next: string) => void;
  onChangeButtons: (next: ButtonTemplateButton[]) => void;
  saving: boolean;
  saveError: string | null;
  isDirty: boolean;
  onSave: () => void;
  onCancel: () => void;
};

export function ButtonTemplateEntryCardExpanded({
  idPrefix,
  panelId,
  labelledBy,
  title,
  body,
  buttons,
  onChangeTitle,
  onChangeBody,
  onChangeButtons,
  saving,
  saveError,
  isDirty,
  onSave,
  onCancel,
}: Props) {
  const canSave =
    !saving &&
    isDirty &&
    title.trim().length > 0 &&
    body.trim().length > 0 &&
    buttons.length > 0;

  return (
    <div
      id={panelId}
      role="region"
      aria-labelledby={labelledBy}
      className="space-y-4 border-t border-border/60 px-3 py-3"
    >
      <ButtonTemplateEntryFields
        idPrefix={idPrefix}
        title={title}
        body={body}
        buttons={buttons}
        onChangeTitle={onChangeTitle}
        onChangeBody={onChangeBody}
        onChangeButtons={onChangeButtons}
        disabled={saving}
      />
      {saveError ? <p className="text-sm text-destructive">{saveError}</p> : null}
      <div className="sticky bottom-0 -mx-3 -mb-3 flex flex-wrap items-center justify-end gap-2 rounded-b-lg border-t border-border/60 bg-card px-3 py-2">
        <Button type="button" variant="outline" size="sm" disabled={saving} onClick={onCancel}>
          Cancel
        </Button>
        <Button type="button" size="sm" disabled={!canSave} onClick={onSave}>
          {saving ? "Saving…" : "Save template"}
        </Button>
      </div>
    </div>
  );
}
