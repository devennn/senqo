import { EvalRunBadge } from "@/pages/dashboard/evals/components/eval-badges";
import type { EvalScheduledRun } from "@/types/evals";

type Props = {
  run: EvalScheduledRun;
};

function formatRunAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function EvalSuiteRunHistoryItem({ run }: Props) {
  const isError = run.status === "error";
  const body = isError
    ? run.errorMessage?.trim() || "Run failed with an unexpected error."
    : run.actualReply.trim() || "(empty reply)";

  return (
    <li className="rounded-md border border-border/70 bg-card px-3 py-3">
      <div className="flex items-center justify-between gap-3">
        <time className="truncate text-xs text-muted-foreground" dateTime={run.ranAt}>
          {formatRunAt(run.ranAt)}
        </time>
        <EvalRunBadge status={run.status} />
      </div>
      <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
        {body}
      </p>
      {run.emailSent && run.notifyEmail ? (
        <p className="mt-2 truncate text-xs text-muted-foreground">
          Emailed {run.notifyEmail}
        </p>
      ) : null}
    </li>
  );
}
