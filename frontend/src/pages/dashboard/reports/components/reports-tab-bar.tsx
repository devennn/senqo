import { cn } from "@/lib/utils";

export type ReportsTab = "metrics" | "reported";

type Props = {
  value: ReportsTab;
  onChange: (tab: ReportsTab) => void;
  reportedCount: number;
};

export function ReportsTabBar({ value, onChange, reportedCount }: Props) {
  return (
    <div
      role="tablist"
      aria-label="Report sections"
      className="mt-6 flex shrink-0 items-center gap-0 border-b border-border/70"
    >
      <TabButton
        id="metrics"
        label="Metrics"
        selected={value === "metrics"}
        onClick={() => onChange("metrics")}
      />
      <TabButton
        id="reported"
        label="Reported conversations"
        count={reportedCount}
        selected={value === "reported"}
        onClick={() => onChange("reported")}
      />
    </div>
  );
}

function TabButton(props: {
  id: ReportsTab;
  label: string;
  count?: number;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      id={`reports-tab-${props.id}`}
      aria-selected={props.selected}
      tabIndex={props.selected ? 0 : -1}
      onClick={props.onClick}
      className={cn(
        "relative -mb-px flex items-center gap-2 px-4 py-2.5 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50",
        props.selected
          ? "border-b-2 border-primary font-semibold text-foreground"
          : "border-b-2 border-transparent font-medium text-muted-foreground hover:text-foreground",
      )}
    >
      {props.label}
      {typeof props.count === "number" ? (
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
          {props.count.toLocaleString()}
        </span>
      ) : null}
    </button>
  );
}