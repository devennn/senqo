import { EvalRunBadge } from "@/pages/dashboard/evals/components/eval-badges";
import type { EvalRun } from "@/types/evals";

type Props = {
  run: EvalRun;
};

function formatRunAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function RunBlock({
  label,
  children,
}: {
  label: string;
  children: string;
}) {
  return (
    <div className="mt-3">
      <p className="text-xs font-semibold tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1.5 whitespace-pre-wrap rounded-md bg-secondary px-3 py-2.5 text-sm leading-relaxed text-foreground dark:bg-muted">
        {children}
      </p>
    </div>
  );
}

export function EvalRunHistoryItem({ run }: Props) {
  const isError = run.status === "error";
  const reply = run.actualReply.trim();
  const reasoning = run.reasoningForOperators?.trim() ?? "";
  const analysis = run.answerAnalysis?.trim() ?? "";
  const errorMessage = run.errorMessage?.trim() || "Run failed with an unexpected error.";
  const handoffTopic = run.handoffTopicLabel?.trim() ?? "";

  return (
    <li className="rounded-md border border-border/70 bg-card px-3 py-3">
      <div className="flex items-center justify-between gap-3">
        <time className="truncate text-xs text-muted-foreground" dateTime={run.ranAt}>
          {formatRunAt(run.ranAt)}
        </time>
        <EvalRunBadge status={run.status} />
      </div>
      {isError ? (
        <RunBlock label="Error">{errorMessage}</RunBlock>
      ) : (
        <>
          {run.handoffCalled ? (
            <RunBlock label="Handoff topic">
              {handoffTopic || "(handoff without topic id)"}
            </RunBlock>
          ) : null}
          <RunBlock label="Reply">{reply || "(empty reply)"}</RunBlock>
          {reasoning ? <RunBlock label="Reasoning">{reasoning}</RunBlock> : null}
          {analysis ? <RunBlock label="Analysis">{analysis}</RunBlock> : null}
        </>
      )}
    </li>
  );
}
