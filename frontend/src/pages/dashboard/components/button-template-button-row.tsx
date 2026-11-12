import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BUTTON_TEMPLATE_BUTTON_LABEL_MAX_LEN } from "@/lib/button-template-limits";
import type { ButtonTemplateButton, ButtonTemplateButtonType } from "@/types/repositories";

export type ButtonTypeOption = {
  value: ButtonTemplateButtonType;
  label: string;
  valueLabel: string;
  placeholder: string;
};

type Props = {
  idPrefix: string;
  index: number;
  button: ButtonTemplateButton;
  options: ButtonTypeOption[];
  disabled: boolean;
  onChange: (patch: Partial<ButtonTemplateButton>) => void;
  onRemove: () => void;
};

/** One editable row: button type, label, type-specific value, remove. */
export function ButtonTemplateButtonRow({
  idPrefix,
  index,
  button,
  options,
  disabled,
  onChange,
  onRemove,
}: Props) {
  const option = options.find((o) => o.value === button.type) ?? options[0];

  return (
    <div className="flex flex-wrap items-end gap-2">
      <label className="space-y-1.5 text-xs text-muted-foreground">
        <span className="block font-medium text-foreground">Type</span>
        <select
          className="flex h-9 rounded-md border border-input bg-transparent px-2 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
          value={button.type}
          disabled={disabled}
          onChange={(e) => onChange({ type: e.target.value as ButtonTemplateButtonType })}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <div className="min-w-[8rem] flex-1 space-y-1.5">
        <Label htmlFor={`${idPrefix}-button-${index}-label`} className="text-xs">
          Label
        </Label>
        <Input
          id={`${idPrefix}-button-${index}-label`}
          value={button.label}
          maxLength={BUTTON_TEMPLATE_BUTTON_LABEL_MAX_LEN}
          placeholder="Yes"
          disabled={disabled}
          onChange={(e) => onChange({ label: e.target.value })}
        />
      </div>
      <div className="min-w-[10rem] flex-1 space-y-1.5">
        <Label htmlFor={`${idPrefix}-button-${index}-value`} className="text-xs">
          {option.valueLabel}
        </Label>
        <Input
          id={`${idPrefix}-button-${index}-value`}
          value={button.value}
          placeholder={option.placeholder}
          disabled={disabled}
          onChange={(e) => onChange({ value: e.target.value })}
        />
      </div>
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        aria-label={`Remove button ${index + 1}`}
        disabled={disabled}
        onClick={onRemove}
      >
        <Trash2 className="size-4" aria-hidden />
      </Button>
    </div>
  );
}
