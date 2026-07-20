import { Input } from "@/components/ui/input";
import { normalizeHandoffPhoneDigits } from "@/lib/handoff-phone";

type Props = {
  id: string;
  valueDigits: string;
  disabled?: boolean;
  invalid?: boolean;
  onDigitsChange: (digits: string) => void;
};

/** Country-code phone field: fixed + prefix, digits-only entry (e.g. 60123456789). */
export function HandoffPhoneInput({
  id,
  valueDigits,
  disabled,
  invalid,
  onDigitsChange,
}: Props) {
  return (
    <div className="relative">
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground"
      >
        +
      </span>
      <Input
        id={id}
        inputMode="tel"
        autoComplete="tel"
        placeholder="60123456789"
        value={valueDigits}
        onChange={(e) => onDigitsChange(normalizeHandoffPhoneDigits(e.target.value))}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        className="pl-7 tabular-nums"
      />
    </div>
  );
}
