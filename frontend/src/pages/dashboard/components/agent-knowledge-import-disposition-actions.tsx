import type { ReactNode } from "react";
import { Check, Loader2, X } from "lucide-react";

type Props = {
  onAccept: () => void;
  onDiscard: () => void;
  applying?: boolean;
};

export function AgentKnowledgeImportDispositionActions({
  onAccept,
  onDiscard,
  applying = false,
}: Props) {
  return (
    <div className="flex shrink-0 items-center gap-0.5">
      <button
        type="button"
        onClick={onAccept}
        aria-label={applying ? "Adding" : "Add"}
        title={applying ? "Adding" : "Add"}
        disabled={applying}
        className="inline-flex size-7 items-center justify-center rounded-md text-primary/70 transition-colors hover:bg-primary/10 hover:text-primary disabled:opacity-70"
      >
        {applying ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : (
          <Check className="size-4" aria-hidden />
        )}
      </button>
      <button
        type="button"
        onClick={onDiscard}
        aria-label="Discard"
        title="Discard"
        disabled={applying}
        className="inline-flex size-7 items-center justify-center rounded-md text-destructive/70 transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-70"
      >
        <X className="size-4" aria-hidden />
      </button>
    </div>
  );
}

export function AgentKnowledgeImportItemHeader({
  label,
  actions,
}: {
  label: string;
  actions: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <p className="text-sm font-medium text-foreground">{label}</p>
      {actions}
    </div>
  );
}

export function showNestedImportDispositionControls(
  groupDisposition: "pending" | "accepted" | "discarded" | "applied",
): boolean {
  return groupDisposition === "pending";
}
