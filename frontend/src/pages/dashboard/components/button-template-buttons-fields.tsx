import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { BUTTON_TEMPLATE_BUTTONS_MAX } from "@/lib/button-template-limits";
import {
  shouldAutoFillReplyId,
  slugifyButtonReplyId,
} from "@/lib/button-template-buttons";
import {
  ButtonTemplateButtonRow,
  type ButtonTypeOption,
} from "@/pages/dashboard/components/button-template-button-row";
import type { ButtonTemplateButton } from "@/types/repositories";

const TYPE_OPTIONS: ButtonTypeOption[] = [
  { value: "quick_reply", label: "Quick reply", valueLabel: "Reply id", placeholder: "yes" },
  { value: "cta_url", label: "Open link", valueLabel: "URL", placeholder: "https://example.com" },
  { value: "cta_call", label: "Call", valueLabel: "Phone", placeholder: "+15551234567" },
  { value: "cta_copy", label: "Copy code", valueLabel: "Code", placeholder: "SAVE10" },
];

type Props = {
  idPrefix: string;
  buttons: ButtonTemplateButton[];
  onChange: (next: ButtonTemplateButton[]) => void;
  disabled?: boolean;
  /**
   * New-template flow: clearing the label also clears the auto-filled reply id.
   * Off by default so ids saved in the database are never wiped while editing.
   */
  clearReplyIdOnLabelClear?: boolean;
};

export function ButtonTemplateButtonsFields({
  idPrefix,
  buttons,
  onChange,
  disabled = false,
  clearReplyIdOnLabelClear = false,
}: Props) {
  const atMax = buttons.length >= BUTTON_TEMPLATE_BUTTONS_MAX;

  function updateButton(index: number, patch: Partial<ButtonTemplateButton>) {
    onChange(
      buttons.map((button, i) => {
        if (i !== index) return button;
        const next: ButtonTemplateButton = { ...button, ...patch };

        // Quick-reply ids follow the label until the author edits the id by hand.
        const labelChanged = patch.label !== undefined && shouldAutoFillReplyId(button);
        const switchedToQuickReply =
          patch.type === "quick_reply" && next.value.trim().length === 0;
        if (labelChanged || switchedToQuickReply) {
          const slug = slugifyButtonReplyId(next.label);
          if (slug.length > 0) {
            next.value = slug;
          } else if (
            labelChanged &&
            clearReplyIdOnLabelClear &&
            next.label.trim().length === 0
          ) {
            // Label deleted again on a new template: drop the auto-filled id too.
            next.value = "";
          }
        }

        return next;
      }),
    );
  }

  function removeButton(index: number) {
    onChange(buttons.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <Label className="text-xs">Buttons</Label>
        <span className="text-xs tabular-nums text-muted-foreground">
          ({buttons.length}/{BUTTON_TEMPLATE_BUTTONS_MAX})
        </span>
        {buttons.some((button) => button.type === "quick_reply") ? (
          <span className="text-xs text-muted-foreground">
            Reply id fills in from the label until you edit it.
          </span>
        ) : null}
      </div>
      {buttons.map((button, index) => (
        <ButtonTemplateButtonRow
          key={`${idPrefix}-button-${index}`}
          idPrefix={idPrefix}
          index={index}
          button={button}
          options={TYPE_OPTIONS}
          disabled={disabled}
          onChange={(patch) => updateButton(index, patch)}
          onRemove={() => removeButton(index)}
        />
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled || atMax}
        onClick={() => onChange([...buttons, { type: "quick_reply", label: "", value: "" }])}
      >
        <Plus className="size-4" aria-hidden />
        Add button
      </Button>
    </div>
  );
}
