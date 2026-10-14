import { cn } from "@/lib/utils";

export type ConnectTab = "whatsapp" | "apps";

type Props = {
  value: ConnectTab;
  onChange: (tab: ConnectTab) => void;
};

export function ConnectTabBar({ value, onChange }: Props) {
  return (
    <div
      role="tablist"
      aria-label="Connect sections"
      className="mt-6 flex w-full gap-1 border-b border-border sm:gap-2"
    >
      <TabButton
        id="whatsapp"
        label="WhatsApp"
        selected={value === "whatsapp"}
        onClick={() => onChange("whatsapp")}
      />
      <TabButton
        id="apps"
        label="Apps"
        selected={value === "apps"}
        onClick={() => onChange("apps")}
      />
    </div>
  );
}

function TabButton(props: {
  id: ConnectTab;
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      id={`connect-tab-${props.id}`}
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
