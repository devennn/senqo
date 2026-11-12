import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ButtonTemplateButtonsFields } from "@/pages/dashboard/components/button-template-buttons-fields";
import { ButtonTemplatePreview } from "@/pages/dashboard/components/button-template-preview";
import type { ButtonTemplateButton } from "@/types/repositories";

type Props = {
  idPrefix: string;
  title: string;
  body: string;
  buttons: ButtonTemplateButton[];
  onChangeTitle: (next: string) => void;
  onChangeBody: (next: string) => void;
  onChangeButtons: (next: ButtonTemplateButton[]) => void;
  disabled?: boolean;
  /** New-template flow: clearing a label clears its auto-filled reply id. */
  clearReplyIdOnLabelClear?: boolean;
};

/** Shared name / message / buttons editor with a live customer preview. */
export function ButtonTemplateEntryFields({
  idPrefix,
  title,
  body,
  buttons,
  onChangeTitle,
  onChangeBody,
  onChangeButtons,
  disabled = false,
  clearReplyIdOnLabelClear = false,
}: Props) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-title`} className="text-xs">
          Name
        </Label>
        <Input
          id={`${idPrefix}-title`}
          value={title}
          onChange={(e) => onChangeTitle(e.target.value)}
          placeholder="Confirm appointment"
          disabled={disabled}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-body`} className="text-xs">
          Message text
        </Label>
        <Textarea
          id={`${idPrefix}-body`}
          value={body}
          onChange={(e) => onChangeBody(e.target.value)}
          rows={3}
          className="min-h-[3.25rem] resize-y text-sm"
          placeholder="What the customer reads above the buttons"
          disabled={disabled}
        />
      </div>
      <ButtonTemplateButtonsFields
        idPrefix={idPrefix}
        buttons={buttons}
        onChange={onChangeButtons}
        disabled={disabled}
        clearReplyIdOnLabelClear={clearReplyIdOnLabelClear}
      />
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">Preview</p>
        <ButtonTemplatePreview body={body} buttons={buttons} />
      </div>
    </div>
  );
}
