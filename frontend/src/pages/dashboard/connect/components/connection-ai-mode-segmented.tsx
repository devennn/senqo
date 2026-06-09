import type { WhatsappConnectionMode } from "@/types/repositories";
import { InlineHelpHint } from "@/components/ui/inline-help-hint";
import { cn } from "@/lib/utils";

const MODES: { id: WhatsappConnectionMode; label: string }[] = [
  { id: "inactive", label: "Inactive" },
  { id: "testing", label: "Testing" },
  { id: "live", label: "Live" },
];

type Props = {
  mode: WhatsappConnectionMode;
  disabled?: boolean;
  onChange: (mode: WhatsappConnectionMode) => void | Promise<void>;
};

export function ConnectionAiModeSegmented({ mode, disabled, onChange }: Props) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <InlineHelpHint label="AI reply mode details">
        <p className="font-semibold text-popover-foreground">Modes</p>
        <ul className="mt-2 list-inside list-disc space-y-1.5 text-popover-foreground">
          <li>
            <strong>Inactive</strong> — no automated WhatsApp replies from the assistant.
          </li>
          <li>
            <strong>Testing</strong> — replies only for CRM contacts marked Test.
          </li>
          <li>
            <strong>Live</strong> — replies for all contacts that reach this line (still respects Human vs AI per conversation).
          </li>
        </ul>
      </InlineHelpHint>
      <div
        className={cn(
          "inline-flex rounded-lg border p-0.5",
          mode === "live" ? "border-primary/30 bg-secondary" : "border-border bg-muted/40"
        )}
      >
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            disabled={disabled}
            aria-pressed={mode === m.id}
            onClick={() => void onChange(m.id)}
            className={cn(
              "rounded-md px-2 py-1 text-xs font-semibold transition disabled:pointer-events-none disabled:opacity-50",
              mode === m.id
                ? "bg-primary text-primary-foreground shadow-sm"
                : mode === "live"
                  ? "!text-primary hover:!text-primary/90"
                  : "text-muted-foreground hover:text-foreground",
            )}
          >
            {m.label}
          </button>
        ))}
      </div>
    </div>
  );
}
