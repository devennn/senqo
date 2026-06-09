import { cn } from "@/lib/utils";

type Props = {
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void | Promise<void>;
};

/** Marks a CRM contact as Test (used when the WhatsApp line is in Testing mode). */
export function ContactTestToggle({ checked, disabled, onChange }: Props) {
  async function handleClick() {
    await onChange(!checked);
  }

  return (
    <button
      type="button"
      aria-label={checked ? "Remove Test label from contact" : "Mark contact as Test"}
      aria-pressed={checked}
      disabled={disabled}
      onClick={() => void handleClick()}
      className="inline-flex justify-self-start rounded-full transition disabled:pointer-events-none disabled:opacity-50"
    >
      <span
        className={cn(
          "relative inline-flex h-5 w-9 items-center rounded-full transition",
          checked ? "bg-primary" : "bg-muted-foreground/30",
        )}
      >
        <span
          className={cn(
            "absolute size-4 rounded-full bg-background shadow-sm transition-transform",
            checked ? "translate-x-4" : "translate-x-0.5",
          )}
        />
      </span>
    </button>
  );
}
