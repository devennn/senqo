import { useState } from "react";
import { BarChart3, MessageSquareWarning } from "lucide-react";
import { AppFrame } from "@/components/layout/app-frame";
import { InlineHelpHint } from "@/components/ui/inline-help-hint";
import { useAgentReports } from "@/hooks/useAgentReports";
import { useConversationReports } from "@/hooks/useConversationReports";
import { TablePagination } from "@/pages/dashboard/components/table-pagination";
import { TableListLoading } from "@/pages/dashboard/components/table-list-loading";
import { ReportsAgentFilter } from "@/pages/dashboard/reports/components/reports-agent-filter";
import { ReportsAgentsTable } from "@/pages/dashboard/reports/components/reports-agents-table";
import { ReportsDateRangeToolbar } from "@/pages/dashboard/reports/components/reports-date-range-toolbar";
import { ReportsHandoffTopicsTable } from "@/pages/dashboard/reports/components/reports-handoff-topics-table";
import { ReportsReportedConversationsTable } from "@/pages/dashboard/reports/components/reports-reported-conversations-table";
import { ReportsSummaryCards } from "@/pages/dashboard/reports/components/reports-summary-cards";
import { ReportsTabBar } from "@/pages/dashboard/reports/components/reports-tab-bar";
import type { ReportsTab } from "@/pages/dashboard/reports/components/reports-tab-bar";
import {
  REPORTS_AGENTS_PAGE_SIZE,
  REPORTS_REPORTED_PAGE_SIZE,
  REPORTS_TOPICS_PAGE_SIZE,
  defaultReportsDateRange,
} from "@/pages/dashboard/reports/reports-format";
import type { ReportsDateRange } from "@/types/reports";

export default function ReportsPage() {
  const [range, setRange] = useState<ReportsDateRange>(() => defaultReportsDateRange());
  const [agentId, setAgentId] = useState<string | null>(null);
  const [tab, setTab] = useState<ReportsTab>("metrics");
  const [agentsPage, setAgentsPage] = useState(1);
  const [topicsPage, setTopicsPage] = useState(1);
  const [reportedPage, setReportedPage] = useState(1);

  const {
    agents,
    topics,
    summary,
    agentOptions,
    loading,
    error,
  } = useAgentReports(range, agentId ?? undefined);

  const reportedPageSafe = reportedPage;
  const { reports: reportedRows, total: reportedTotal, loading: reportedLoading, error: reportedError } =
    useConversationReports({
      range,
      agentId: agentId ?? undefined,
      page: reportedPageSafe,
      pageSize: REPORTS_REPORTED_PAGE_SIZE,
    });

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

  const reportedListTotalPages = Math.max(
    1,
    Math.ceil(reportedTotal / REPORTS_REPORTED_PAGE_SIZE),
  );
  const reportedSafePageFinal = Math.min(reportedPageSafe, reportedListTotalPages);

  function handleRangeChange(next: ReportsDateRange) {
    setRange(next);
    setAgentsPage(1);
    setTopicsPage(1);
    setReportedPage(1);
  }

  function handleAgentChange(nextAgentId: string | null) {
    setAgentId(nextAgentId);
    setAgentsPage(1);
    setTopicsPage(1);
    setReportedPage(1);
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
                    Use these numbers to see how automation is performing: conversation volume,
                    messages sent, handoffs to humans, and errors — both technical send failures and
                    conversations your team reported as wrong.
                  </p>
                </InlineHelpHint>
              </div>
              <p className="mt-1.5 text-base text-muted-foreground">
                Review agent volume, handoffs, errors, and reported conversations.
              </p>
            </div>
            <div className="flex flex-wrap items-end justify-end gap-3">
              <ReportsAgentFilter
                agents={agentOptions}
                value={agentId ?? ""}
                onChange={handleAgentChange}
              />
              <ReportsDateRangeToolbar range={range} onRangeChange={handleRangeChange} />
            </div>
          </div>

          {error ? (
            <p className="mt-6 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {error}
            </p>
          ) : null}

          <ReportsTabBar value={tab} onChange={setTab} reportedCount={reportedTotal} />

          {tab === "metrics" ? (
            loading ? (
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
                        topic in the selected date range. Click a topic to open it under Knowledge →
                        Human handoff. “No topic” means the handoff had no matching configured topic.
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
            )
          ) : (
            <div className="mt-8">
              <div className="mb-4 flex flex-wrap items-center gap-2 text-lg font-semibold">
                <BarChart3 className="size-5 text-primary" />
                <h2 className="text-lg font-semibold">Reported conversations</h2>
                <InlineHelpHint label="About reported conversations">
                  <p>
                    Conversations your team flagged as wrong from the chats list or an open
                    conversation, with the reason they gave. Reports are counted on the date they
                    were submitted.
                  </p>
                </InlineHelpHint>
                <span className="rounded-full bg-muted px-2.5 py-0.5 text-sm font-semibold text-muted-foreground">
                  {reportedTotal}
                </span>
              </div>
              {reportedLoading ? (
                <div className="mt-6">
                  <TableListLoading label="Loading reported conversations" />
                </div>
              ) : reportedError ? (
                <p className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                  {reportedError}
                </p>
              ) : reportedRows.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border/70 px-4 py-8 text-center text-muted-foreground">
                  No reported conversations in this date range.
                </p>
              ) : (
                <>
                  <ReportsReportedConversationsTable rows={reportedRows} />
                  <TablePagination
                    page={reportedSafePageFinal}
                    total={reportedTotal}
                    pageSize={REPORTS_REPORTED_PAGE_SIZE}
                    onPage={setReportedPage}
                  />
                </>
              )}
            </div>
          )}
        </section>
      }
    />
  );
}