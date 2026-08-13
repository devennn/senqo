import { EvalRunHistoryItem } from "@/pages/dashboard/evals/components/eval-run-history-item";
import type { EvalRun } from "@/types/evals";

type Props = {
  runs: EvalRun[];
};

export function EvalRunHistory({ runs }: Props) {
  if (runs.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        No runs yet. Use Run in the header to run this eval.
      </p>
    );
  }

  return (
    <ol className="space-y-4">
      {runs.map((run) => (
        <EvalRunHistoryItem key={run.id} run={run} />
      ))}
    </ol>
  );
}
