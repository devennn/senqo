import { EVAL_SUITE_RUN_PAGE_SIZE } from "@/hooks/useEvalSchedule";
import { TablePagination } from "@/pages/dashboard/components/table-pagination";
import { EvalSuiteRunHistoryItem } from "@/pages/dashboard/evals/components/eval-suite-run-history-item";
import type { EvalScheduledRun } from "@/types/evals";

type Props = {
  runs: EvalScheduledRun[];
  page: number;
  total: number;
  onPage: (page: number) => void;
};

export function EvalSuiteRunHistory({ runs, page, total, onPage }: Props) {
  const showPagination = total > EVAL_SUITE_RUN_PAGE_SIZE;

  return (
    <div>
      <p className="text-sm font-medium text-foreground">Scheduled runs</p>
      {runs.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">No scheduled runs yet.</p>
      ) : (
        <ol className="mt-3 space-y-2">
          {runs.map((run) => (
            <EvalSuiteRunHistoryItem key={run.id} run={run} />
          ))}
        </ol>
      )}
      {showPagination ? (
        <TablePagination
          page={page}
          total={total}
          pageSize={EVAL_SUITE_RUN_PAGE_SIZE}
          onPage={onPage}
          compact
        />
      ) : null}
    </div>
  );
}
