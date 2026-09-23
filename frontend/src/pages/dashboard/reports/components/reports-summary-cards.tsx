import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { InlineHelpHint } from "@/components/ui/inline-help-hint";
import { REPORTS_DEFINITIONS, hintLabel } from "@/pages/dashboard/reports/reports-definitions";
import { formatHandoffRate } from "@/pages/dashboard/reports/reports-format";
import type { AgentPerformanceSummary } from "@/types/reports";

type Props = {
  summary: AgentPerformanceSummary;
};

const METRICS: {
  key: keyof AgentPerformanceSummary | "handoffRate";
  label: string;
}[] = [
  { key: "totalConversations", label: "Total conversations" },
  { key: "conversationsHandled", label: "Conversations handled" },
  { key: "totalMessages", label: "Total messages" },
  { key: "aiReplies", label: "AI replies" },
  { key: "handoffs", label: "Handoffs" },
  { key: "handoffRate", label: "Handoff rate" },
  { key: "technicalErrors", label: "Technical errors" },
  { key: "reportedErrors", label: "Reported errors" },
];

export function ReportsSummaryCards({ summary }: Props) {
  return (
    <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {METRICS.map((metric) => {
        const value =
          metric.key === "handoffRate"
            ? formatHandoffRate(summary.conversationsHandled, summary.handoffs)
            : summary[metric.key].toLocaleString();
        return (
          <Card key={metric.key} size="sm" className="rounded-2xl shadow-soft">
            <CardHeader className="pb-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {metric.label}
              </CardTitle>
              <CardAction>
                <InlineHelpHint label={hintLabel(metric.label)} className="size-6">
                  <p>{REPORTS_DEFINITIONS[metric.key]}</p>
                </InlineHelpHint>
              </CardAction>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold tracking-tight text-foreground">{value}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}