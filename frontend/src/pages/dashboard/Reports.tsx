import { useState } from "react";
import { BarChart3, MessageSquareWarning } from "lucide-react";
import { AppFrame } from "@/components/layout/app-frame";
import { InlineHelpHint } from "@/components/ui/inline-help-hint";
import { useAgentReports } from "@/hooks/useAgentReports";
import { TablePagination } from "@/pages/dashboard/components/table-pagination";
import { TableListLoading } from "@/pages/dashboard/components/table-list-loading";
import { ReportsAgentsTable } from "@/pages/dashboard/reports/components/reports-agents-table";
import { ReportsDateRangeToolbar } from "@/pages/dashboard/reports/components/reports-date-range-toolbar";
import { ReportsHandoffTopicsTable } from "@/pages/dashboard/reports/components/reports-handoff-topics-table";
import { ReportsSummaryCards } from "@/pages/dashboard/reports/components/reports-summary-cards";
import {
  REPORTS_AGENTS_PAGE_SIZE,
  REPORTS_TOPICS_PAGE_SIZE,
  defaultReportsDateRange,
} from "@/pages/dashboard/reports/reports-format";
import type { ReportsDateRange } from "@/types/reports";

export default function ReportsPage() {
  const [range, setRange] = useState<ReportsDateRange>(() => defaultReportsDateRange());
  const [agentsPage, setAgentsPage] = useState(1);
  const [topicsPage, setTopicsPage] = useState(1);
  const { agents, topics, summary, loading, error } = useAgentReports(range);

  const agentsTotalPages = Math.max(1, Math.ceil(agents.length / REPORTS_AGENTS_PAGE_SIZE));
  const agentsSafePage = Math.min(agentsPage, agentsTotalPages);
  const pageRows = agents.slice(
    (agentsSafePage - 1) * REPORTS_AGENTS_PAGE_SIZE,
    agentsSafePage * REPORTS_AGENTS_PAGE_SIZE,
  );

  const topicsTotalPages = Math.max(1, Math.ceil(topics.length / REPORTS_TOPICS_PAGE_SIZE));
  const topicsSafePage = Math.min(topicsPage, topicsTotalPages);
  const pageTopics = topics.slice(
    (topicsSafePage - 1) * REPORTS_TOPICS_PAGE_SIZE,
    topicsSafePage * REPORTS_TOPICS_PAGE_SIZE,
  );

  function handleRangeChange(next: ReportsDateRange) {
    setRange(next);
    setAgentsPage(1);
    setTopicsPage(1);
  }

  return (
    <AppFrame
      conversations={[]}
      messages={[]}
      hideConversationRail
      mainPanel={
        <section className="flex min-h-0 w-full flex-1 flex-col overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-extrabold tracking-tight">Reports</h1>
                <InlineHelpHint label="About agent reports">
                  <p>
                    Use these numbers to see how automation is performing: volume handled, replies
                    sent, and how often chats escalate to a human.
                  </p>
                </InlineHelpHint>
              </div>
              <p className="mt-1.5 text-base text-muted-foreground">
                Review each agent’s conversation volume and handoffs.
              </p>
            </div>
            <ReportsDateRangeToolbar range={range} onRangeChange={handleRangeChange} />
          </div>

          {error ? (
            <p className="mt-6 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {error}
            </p>
          ) : null}

          {loading ? (
            <div className="mt-6">
              <TableListLoading label="Loading reports" />
            </div>
          ) : (
            <>
              <ReportsSummaryCards summary={summary} />

              <div className="mt-8">
                <div className="mb-4 flex flex-wrap items-center gap-2 text-lg font-semibold">
                  <BarChart3 className="size-5 text-primary" />
                  <h2 className="text-lg font-semibold">Agents</h2>
                  <span className="rounded-full bg-muted px-2.5 py-0.5 text-sm font-semibold text-muted-foreground">
                    {agents.length}
                  </span>
                </div>
                {agents.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-border/70 px-4 py-8 text-center text-muted-foreground">
                    No agents in this workspace yet.
                  </p>
                ) : (
                  <>
                    <ReportsAgentsTable agents={pageRows} />
                    <TablePagination
                      page={agentsSafePage}
                      total={agents.length}
                      pageSize={REPORTS_AGENTS_PAGE_SIZE}
                      onPage={setAgentsPage}
                    />
                  </>
                )}
              </div>

              <div className="mt-10">
                <div className="mb-4 flex flex-wrap items-center gap-2 text-lg font-semibold">
                  <MessageSquareWarning className="size-5 text-primary" />
                  <h2 className="text-lg font-semibold">Handoff topics</h2>
                  <InlineHelpHint label="About handoff topic reports">
                    <p>
                      Topics ranked by how often agents handed conversations to a human for that
                      topic in the selected date range.
                    </p>
                  </InlineHelpHint>
                  <span className="rounded-full bg-muted px-2.5 py-0.5 text-sm font-semibold text-muted-foreground">
                    {topics.length}
                  </span>
                </div>
                {topics.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-border/70 px-4 py-8 text-center text-muted-foreground">
                    No handoffs in this date range.
                  </p>
                ) : (
                  <>
                    <ReportsHandoffTopicsTable
                      topics={pageTopics}
                      totalHandoffs={summary.handoffs}
                    />
                    <TablePagination
                      page={topicsSafePage}
                      total={topics.length}
                      pageSize={REPORTS_TOPICS_PAGE_SIZE}
                      onPage={setTopicsPage}
                    />
                  </>
                )}
              </div>
            </>
          )}
        </section>
      }
    />
  );
}
