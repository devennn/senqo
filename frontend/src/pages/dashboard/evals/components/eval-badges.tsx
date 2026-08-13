import { cn } from "@/lib/utils";
import type { EvalRunStatus } from "@/types/evals";

export function EvalRunBadge({
  status,
}: {
  status: EvalRunStatus | null | undefined;
}) {
  if (status == null) {
    return (
      <span className="shrink-0 whitespace-nowrap rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
        Not run
      </span>
    );
  }

  const styles =
    status === "passed"
      ? "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300"
      : status === "error"
        ? "bg-amber-500/15 text-amber-800 dark:text-amber-300"
        : "bg-destructive/15 text-destructive";

  const label =
    status === "passed" ? "Passed" : status === "error" ? "Error" : "Failed";

  return (
    <span
      className={cn(
        "shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold",
        styles,
      )}
    >
      {label}
    </span>
  );
}
