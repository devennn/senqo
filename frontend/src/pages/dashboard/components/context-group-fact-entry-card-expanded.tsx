import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const TITLE_MAX = 200;
const BODY_MAX = 8000;

type Props = {
  entryId: string;
  panelId: string;
  labelledBy: string;
  title: string;
  bodyText: string;
  onTitleChange: (value: string) => void;
  onBodyChange: (value: string) => void;
  saving: boolean;
  saveError: string | null;
  isDirty: boolean;
  onSave: () => void;
};

export function ContextGroupFactEntryCardExpanded({
  entryId,
  panelId,
  labelledBy,
  title,
  bodyText,
  onTitleChange,
  onBodyChange,
  saving,
  saveError,
  isDirty,
  onSave,
}: Props) {
  const titleId = `ctx-expand-title-${entryId}`;
  const bodyId = `ctx-expand-body-${entryId}`;

  return (
    <div
      id={panelId}
      role="region"
      aria-labelledby={labelledBy}
      className="space-y-3 border-t border-border/60 px-3 pb-3 pt-3"
    >
      <div className="space-y-2">
        <Label htmlFor={titleId} className="text-xs">
          Title
        </Label>
        <Input
          id={titleId}
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          maxLength={TITLE_MAX}
          disabled={saving}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={bodyId} className="text-xs">
          Facts
        </Label>
        <Textarea
          id={bodyId}
          value={bodyText}
          onChange={(e) => onBodyChange(e.target.value)}
          maxLength={BODY_MAX}
          rows={5}
          disabled={saving}
          className="font-mono text-sm"
        />
      </div>
      {saveError ? <p className="text-sm text-destructive">{saveError}</p> : null}
      <Button
        type="button"
        size="sm"
        disabled={saving || !isDirty || title.trim().length === 0 || bodyText.trim().length === 0}
        onClick={onSave}
      >
        {saving ? "Saving…" : "Save"}
      </Button>
    </div>
  );
}
