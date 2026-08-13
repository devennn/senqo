import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { EVALS_UI_PAGE_SIZE } from "@/hooks/useEvals";
import { TablePagination } from "@/pages/dashboard/components/table-pagination";
import { EvalsList } from "@/pages/dashboard/evals/components/evals-list";
import type { EvalAgentOption, EvalCase } from "@/types/evals";

type Props = {
  agents: EvalAgentOption[];
  agentId: string;
  agentsLoading: boolean;
  onAgentChange: (agentId: string) => void;
  cases: EvalCase[];
  selectedId: string | null;
  loading: boolean;
  page: number;
  total: number;
  onPage: (page: number) => void;
  onSelect: (id: string) => void;
};

export function EvalsSidebar({
  agents,
  agentId,
  agentsLoading,
  onAgentChange,
  cases,
  selectedId,
  loading,
  page,
  total,
  onPage,
  onSelect,
}: Props) {
  const showPagination = total > EVALS_UI_PAGE_SIZE;

  return (
    <Card className="min-h-0 flex-1 gap-0 overflow-hidden rounded-2xl py-0">
      <CardHeader className="shrink-0 border-b border-border/70 px-4 py-3">
        <div className="flex items-center gap-2">
          <Label htmlFor="evals-agent-filter" className="shrink-0 text-sm font-medium text-muted-foreground">
            Agent:
          </Label>
          <select
            id="evals-agent-filter"
            className="h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:border-2 focus-visible:border-ring"
            value={agentId}
            disabled={agentsLoading || agents.length === 0}
            onChange={(event) => onAgentChange(event.target.value)}
          >
            {agents.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.name}
              </option>
            ))}
          </select>
        </div>
      </CardHeader>
      <CardContent className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {loading ? (
          <p className="py-6 text-sm text-muted-foreground">Loading evals…</p>
        ) : (
          <EvalsList cases={cases} selectedId={selectedId} onSelect={onSelect} />
        )}
      </CardContent>
      {showPagination ? (
        <div className="shrink-0 px-4 pb-3">
          <TablePagination
            page={page}
            total={total}
            pageSize={EVALS_UI_PAGE_SIZE}
            onPage={onPage}
            compact
          />
        </div>
      ) : null}
    </Card>
  );
}
