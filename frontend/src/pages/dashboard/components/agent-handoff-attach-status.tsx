import { Loader2 } from "lucide-react";

type Props = {
  saving: boolean;
  saveSuccess: string | null;
  saveError: string | null;
};

export function AgentHandoffAttachStatus({ saving, saveSuccess, saveError }: Props) {
  if (saving) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status" aria-live="polite">
        <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
        Saving handoff settings…
      </p>
    );
  }
  if (saveSuccess) {
    return (
      <p
        className="rounded-md border border-primary/40 bg-secondary px-3 py-2 text-sm text-secondary-foreground"
        role="status"
        aria-live="polite"
      >
        {saveSuccess}
      </p>
    );
  }
  if (saveError) {
    return <p className="text-sm text-destructive">{saveError}</p>;
  }
  return null;
}
