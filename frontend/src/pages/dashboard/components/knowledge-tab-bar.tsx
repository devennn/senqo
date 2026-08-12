import { cn } from "@/lib/utils";

export type KnowledgeTab = "context" | "templates" | "handoff";

type Props = {
  value: KnowledgeTab;
  onChange: (tab: KnowledgeTab) => void;
};

export function KnowledgeTabBar({ value, onChange }: Props) {
  return (
    <div
      role="tablist"
      aria-label="Knowledge sections"
      className="mt-6 flex w-full gap-1 border-b border-border sm:gap-2"
    >
      <TabButton id="context" label="Context" selected={value === "context"} onClick={() => onChange("context")} />
      <TabButton
        id="templates"
        label="Response templates"
        selected={value === "templates"}
        onClick={() => onChange("templates")}
      />
      <TabButton
        id="handoff"
        label="Human handoff"
        selected={value === "handoff"}
        onClick={() => onChange("handoff")}
      />
    </div>
  );
}

function TabButton(props: { id: KnowledgeTab; label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      role="tab"
      id={`knowledge-tab-${props.id}`}
      aria-selected={props.selected}
      tabIndex={props.selected ? 0 : -1}
      onClick={props.onClick}
      className={cn(
        "relative -mb-px min-h-10 flex-1 rounded-none border-b-2 bg-transparent px-3 py-2.5 text-sm outline-none transition-[color,border-color] focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:min-h-0 sm:flex-none sm:px-4",
        props.selected
          ? "border-primary font-semibold text-foreground"
          : "border-transparent font-medium text-muted-foreground hover:border-border hover:text-foreground",
      )}
    >
      {props.label}
    </button>
  );
}
