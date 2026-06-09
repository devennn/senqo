import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { InlineHelpHint } from "@/components/ui/inline-help-hint";

type Props = {
  entryId: string;
  panelId: string;
  labelledBy: string;
  questionText: string;
  answerText: string;
  onQuestionChange: (value: string) => void;
  onAnswerChange: (value: string) => void;
  saving: boolean;
  saveError: string | null;
  isDirty: boolean;
  onSave: () => void;
};

export function ResponseTemplateGroupEntryCardExpanded({
  entryId,
  panelId,
  labelledBy,
  questionText,
  answerText,
  onQuestionChange,
  onAnswerChange,
  saving,
  saveError,
  isDirty,
  onSave,
}: Props) {
  const qId = `rtp-q-${entryId}`;
  const aId = `rtp-a-${entryId}`;

  return (
    <div
      id={panelId}
      role="region"
      aria-labelledby={labelledBy}
      className="space-y-2 border-t border-border/60 px-3 pb-3 pt-3"
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <InlineHelpHint label="Editing a template row">
          <>
            <p>
              <span className="font-medium text-popover-foreground">Question</span> is how the shopper might phrase the
              ask.
            </p>
            <p>
              <span className="font-medium text-popover-foreground">Answer</span> is the exact reply sent on WhatsApp.
            </p>
          </>
        </InlineHelpHint>
      </div>
      <div className="space-y-2">
        <Label htmlFor={qId} className="text-xs">
          Question
        </Label>
        <Textarea
          id={qId}
          value={questionText}
          onChange={(e) => onQuestionChange(e.target.value)}
          rows={2}
          className="min-h-[2.75rem] resize-y text-sm"
          placeholder="How the shopper might phrase it"
          disabled={saving}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={aId} className="text-xs">
          Answer
        </Label>
        <Textarea
          id={aId}
          value={answerText}
          onChange={(e) => onAnswerChange(e.target.value)}
          rows={3}
          className="min-h-[4rem] resize-y text-sm"
          placeholder="Verbatim WhatsApp reply"
          disabled={saving}
        />
      </div>
      {saveError ? <p className="text-sm text-destructive">{saveError}</p> : null}
      <Button
        type="button"
        size="sm"
        disabled={saving || !isDirty || questionText.trim().length === 0 || answerText.trim().length === 0}
        onClick={onSave}
      >
        {saving ? "Saving…" : "Save template"}
      </Button>
    </div>
  );
}
