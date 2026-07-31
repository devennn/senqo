import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatHandoffRate } from "@/pages/dashboard/reports/reports-format";
import type { AgentPerformanceRow } from "@/types/reports";

type Props = {
  agents: AgentPerformanceRow[];
};

export function ReportsAgentsTable({ agents }: Props) {
  return (
    <>
      <div className="space-y-3 md:hidden">
        {agents.map((agent) => (
          <article
            key={agent.id}
            className="rounded-2xl border border-border bg-card p-4 shadow-soft"
          >
            <h3 className="text-base font-semibold text-foreground">{agent.name}</h3>
            <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Conversations
                </dt>
                <dd className="mt-1 font-medium">{agent.conversationsHandled.toLocaleString()}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  AI replies
                </dt>
                <dd className="mt-1 font-medium">{agent.aiReplies.toLocaleString()}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Handoffs
                </dt>
                <dd className="mt-1 font-medium">{agent.handoffs.toLocaleString()}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Handoff rate
                </dt>
                <dd className="mt-1 font-medium">
                  {formatHandoffRate(agent.conversationsHandled, agent.handoffs)}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  In human mode
                </dt>
                <dd className="mt-1 font-medium">{agent.inHumanMode.toLocaleString()}</dd>
              </div>
            </dl>
          </article>
        ))}
      </div>
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Agent</TableHead>
              <TableHead className="text-right">Conversations</TableHead>
              <TableHead className="text-right">AI replies</TableHead>
              <TableHead className="text-right">Handoffs</TableHead>
              <TableHead className="text-right">Handoff rate</TableHead>
              <TableHead className="text-right">In human mode</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {agents.map((agent) => (
              <TableRow key={agent.id}>
                <TableCell className="font-medium">{agent.name}</TableCell>
                <TableCell className="text-right">
                  {agent.conversationsHandled.toLocaleString()}
                </TableCell>
                <TableCell className="text-right">{agent.aiReplies.toLocaleString()}</TableCell>
                <TableCell className="text-right">{agent.handoffs.toLocaleString()}</TableCell>
                <TableCell className="text-right">
                  {formatHandoffRate(agent.conversationsHandled, agent.handoffs)}
                </TableCell>
                <TableCell className="text-right">{agent.inHumanMode.toLocaleString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
