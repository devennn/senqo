import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type EvalDetailTab = "conversation" | "history";

type Props = {
  value: EvalDetailTab;
  onChange: (tab: EvalDetailTab) => void;
  trailing?: ReactNode;
};

export function EvalDetailTabBar({ value, onChange, trailing }: Props) {
  return (
    <div className="flex shrink-0 items-center gap-2 border-b border-border/70 bg-background px-1 pr-3">
      <div
        role="tablist"
        aria-label="Eval detail sections"
        className="flex min-w-0 flex-1 gap-0"
      >
        <TabButton
          id="conversation"
          label="Conversation"
          selected={value === "conversation"}
          onClick={() => onChange("conversation")}
        />
        <TabButton
          id="history"
          label="Run history"
          selected={value === "history"}
          onClick={() => onChange("history")}
        />
      </div>
      {trailing ? <div className="flex shrink-0 items-center gap-2">{trailing}</div> : null}
    </div>
  );
}

function TabButton(props: {
  id: EvalDetailTab;
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      id={`eval-detail-tab-${props.id}`}
      aria-selected={props.selected}
      tabIndex={props.selected ? 0 : -1}
      onClick={props.onClick}
      className={cn(
        "relative -mb-px px-4 py-2.5 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50",
        props.selected
          ? "border-b-2 border-primary font-semibold text-foreground"
          : "border-b-2 border-transparent font-medium text-muted-foreground hover:text-foreground",
      )}
    >
      {props.label}
    </button>
  );
}
