import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

type Props = {
  panelId: string;
  labelledBy?: string;
  topic: string;
  description: string;
  saving: boolean;
  saveError: string | null;
  isDirty: boolean;
  onTopicChange: (v: string) => void;
  onDescriptionChange: (v: string) => void;
  onSave: () => void;
};

export function HandoffTopicGroupEntryForm({
  panelId,
  labelledBy,
  topic,
  description,
  saving,
  saveError,
  isDirty,
  onTopicChange,
  onDescriptionChange,
  onSave,
}: Props) {
  return (
    <div
      id={panelId}
      role="region"
      aria-labelledby={labelledBy}
      className="border-t border-border/60 px-3 py-4"
    >
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor={`${panelId}-topic`}>Topic</Label>
          <Input
            id={`${panelId}-topic`}
            value={topic}
            onChange={(e) => onTopicChange(e.target.value)}
            disabled={saving}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${panelId}-desc`}>Description</Label>
          <Textarea
            id={`${panelId}-desc`}
            value={description}
            onChange={(e) => onDescriptionChange(e.target.value)}
            rows={3}
            className="min-h-[4.5rem] resize-y"
            disabled={saving}
          />
        </div>
        {saveError ? <p className="text-sm text-destructive">{saveError}</p> : null}
        <Button type="button" size="sm" disabled={saving || !isDirty} onClick={onSave}>
          {saving ? "Saving…" : "Save topic"}
        </Button>
      </div>
    </div>
  );
}
