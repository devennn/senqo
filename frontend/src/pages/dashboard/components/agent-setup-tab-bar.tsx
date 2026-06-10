import { cn } from "@/lib/utils";

export type AgentSetupTab = "profile" | "context" | "skills" | "tools" | "templates" | "handoff" | "assets";

type Props = {
  value: AgentSetupTab;
  onChange: (tab: AgentSetupTab) => void;
};

export function AgentSetupTabBar({ value, onChange }: Props) {
  return (
    <div
      role="tablist"
      aria-label="Agent setup sections"
      className="mt-6 flex w-full gap-1 border-b border-border sm:gap-2"
    >
      <TabButton id="profile" label="Profile" selected={value === "profile"} onClick={() => onChange("profile")} />
      <TabButton id="context" label="Context" selected={value === "context"} onClick={() => onChange("context")} />
      <TabButton id="skills" label="Skill Catalog" selected={value === "skills"} onClick={() => onChange("skills")} />
      <TabButton id="tools" label="Tool Catalog" selected={value === "tools"} onClick={() => onChange("tools")} />
      <TabButton id="templates" label="Response templates" selected={value === "templates"} onClick={() => onChange("templates")} />
      <TabButton id="handoff" label="Human handoff" selected={value === "handoff"} onClick={() => onChange("handoff")} />
      <TabButton id="assets" label="Assets" selected={value === "assets"} onClick={() => onChange("assets")} />
    </div>
  );
}

function TabButton(props: { id: AgentSetupTab; label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      role="tab"
      id={`agent-tab-${props.id}`}
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
