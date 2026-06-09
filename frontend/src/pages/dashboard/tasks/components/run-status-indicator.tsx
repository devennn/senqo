import { Badge } from "@/components/ui/badge";

type RunStatusIndicatorProps = {
  scheduleType: "recurring" | "one_time";
  taskStatus?: "active" | "cancelled";
  recentRuns: Array<{
    status: "success" | "fail";
    created_at: string;
  }>;
  lastRunStatus: "success" | "fail" | null;
};

function dotColor(status: "success" | "fail"): string {
  return status === "success" ? "bg-primary" : "bg-red-500";
}

export function RunStatusIndicator({
  scheduleType,
  taskStatus = "active",
  recentRuns,
  lastRunStatus,
}: RunStatusIndicatorProps) {
  if (taskStatus === "cancelled") {
    return <Badge variant="secondary">Cancelled</Badge>;
  }

  if (scheduleType === "one_time") {
    if (!lastRunStatus) {
      return <Badge variant="secondary">Pending</Badge>;
    }
    return (
      <Badge variant={lastRunStatus === "success" ? "default" : "destructive"}>
        {lastRunStatus === "success" ? "Success" : "Fail"}
      </Badge>
    );
  }

  return (
    <div className="flex items-center gap-1.5" aria-label="Last 5 runs">
      {Array.from({ length: 5 }).map((_, index) => {
        const run = recentRuns[index];
        return (
          <span
            key={`${run?.created_at ?? "empty"}-${index}`}
            className={`inline-block size-2.5 rounded-full ${run ? dotColor(run.status) : "bg-muted-foreground/30"}`}
            title={run ? `${run.status} at ${new Date(run.created_at).toLocaleString()}` : "Not run"}
          />
        );
      })}
    </div>
  );
}
