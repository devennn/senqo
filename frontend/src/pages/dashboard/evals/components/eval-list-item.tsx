import { CalendarClock } from "lucide-react";
import { EvalRunBadge } from "@/pages/dashboard/evals/components/eval-badges";
import type { EvalCase } from "@/types/evals";
import { cn } from "@/lib/utils";

type Props = {
  item: EvalCase;
  selected: boolean;
  onSelect: () => void;
};

export function EvalListItem({ item, selected, onSelect }: Props) {
  const hasSchedule = item.hasSchedule;

  return (
    <li>
      <button
        type="button"
        aria-label={`Select ${item.title}`}
        aria-current={selected ? "true" : undefined}
        onClick={onSelect}
        className={cn(
          "flex w-full items-center gap-3 rounded-md border px-3 py-3 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
          selected
            ? "border-primary bg-primary/5"
            : "border-border/70 bg-card hover:bg-muted/40 dark:hover:bg-muted/30",
        )}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p
              className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground"
              title={item.title}
            >
              {item.title}
            </p>
            {hasSchedule ? (
              <CalendarClock
                className="size-3.5 shrink-0 text-primary"
                aria-label="Has a schedule"
              />
            ) : null}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
            <EvalRunBadge status={item.runs[0]?.status} />
            <span className="text-xs text-muted-foreground">
              {item.source === "manual"
                ? "Manual"
                : item.source === "template"
                  ? "From template"
                  : item.source === "context"
                    ? "From context"
                    : item.source === "handoff"
                      ? "From handoff"
                      : "From chat"}
            </span>
          </div>
        </div>
      </button>
    </li>
  );
}
