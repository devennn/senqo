import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatHandoffRate } from "@/pages/dashboard/reports/reports-format";
import type { AgentPerformanceSummary } from "@/types/reports";

type Props = {
  summary: AgentPerformanceSummary;
};

const METRICS: {
  key: keyof AgentPerformanceSummary | "handoffRate";
  label: string;
}[] = [
  { key: "conversationsHandled", label: "Conversations" },
  { key: "aiReplies", label: "AI replies" },
  { key: "handoffs", label: "Handoffs" },
  { key: "handoffRate", label: "Handoff rate" },
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
