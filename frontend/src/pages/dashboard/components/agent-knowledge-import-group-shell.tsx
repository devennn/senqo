import type { ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Props = {
  kindLabel: string;
  name: string;
  nameInputId: string;
  onNameChange: (value: string) => void;
  actions: ReactNode;
  surfaceClass?: string;
  children: ReactNode;
};

export function AgentKnowledgeImportGroupShell({
  kindLabel,
  name,
  nameInputId,
  onNameChange,
  actions,
  surfaceClass,
  children,
}: Props) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border border-border/70 bg-card shadow-soft",
        surfaceClass,
      )}
    >
      <div className="flex items-start justify-between gap-3 border-b border-border/60 bg-muted/40 px-4 py-3">
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-xs font-medium text-muted-foreground">{kindLabel}</p>
          <Input
            id={nameInputId}
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="Untitled group"
            aria-label={`${kindLabel} name`}
            className="h-8 border-0 bg-transparent px-0 text-base font-semibold shadow-none focus-visible:ring-0"
          />
        </div>
        <div className="shrink-0 pt-0.5">{actions}</div>
      </div>
      <div className="space-y-3 p-4">{children}</div>
    </div>
  );
}
