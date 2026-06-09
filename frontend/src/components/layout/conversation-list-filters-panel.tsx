import { useState } from "react";
import { ChevronDown, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ConversationLabelRecord, WhatsappConnection } from "@/types/repositories";

function connectionSelectLabel(conn: WhatsappConnection): string {
  const name = conn.display_name?.trim() ?? "";
  const phone = conn.phone_number?.trim() ?? "";
  if (name && phone) return `${name} (${phone})`;
  if (name) return name;
  if (phone) return phone;
  return "WhatsApp line";
}

export function ConversationListFiltersPanel({
  labelCatalog,
  currentLabelId,
  onLabelFilter,
  humanOnlyFilter,
  onHumanOnlyFilter,
  whatsappConnections,
  currentConnectionId,
  onConnectionFilter,
}: {
  labelCatalog: ConversationLabelRecord[];
  currentLabelId: string;
  onLabelFilter: (nextLabelId: string) => void;
  humanOnlyFilter: boolean;
  onHumanOnlyFilter: (next: boolean) => void;
  whatsappConnections: WhatsappConnection[];
  currentConnectionId: string;
  onConnectionFilter: (nextConnectionId: string) => void;
}) {
  const activeCount =
    (currentLabelId.trim() ? 1 : 0) +
    (humanOnlyFilter ? 1 : 0) +
    (currentConnectionId.trim() ? 1 : 0);
  const [open, setOpen] = useState(activeCount > 0);

  return (
    <div className="shrink-0 border-b border-border/40 bg-muted/15">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setOpen((v) => !v)}
        className="h-9 w-full justify-between gap-2 rounded-none px-3 text-xs font-medium text-muted-foreground hover:text-foreground"
        aria-expanded={open}
        aria-controls="conversation-list-filters"
        id="conversation-list-filters-trigger"
      >
        <span className="flex min-w-0 items-center gap-2">
          <SlidersHorizontal className="size-3.5 shrink-0 opacity-80" aria-hidden />
          <span className="truncate">Filters</span>
          {activeCount > 0 ? (
            <span className="rounded-full bg-primary/15 px-1.5 py-px text-[10px] font-semibold tabular-nums text-primary">
              {activeCount}
            </span>
          ) : null}
        </span>
        <ChevronDown
          className={cn("size-4 shrink-0 opacity-70 transition-transform", open && "rotate-180")}
          aria-hidden
        />
      </Button>
      {open ? (
        <div
          id="conversation-list-filters"
          role="region"
          aria-labelledby="conversation-list-filters-trigger"
          className="space-y-2 border-t border-border/30 px-3 pb-3 pt-2"
        >
          {labelCatalog.length > 0 ? (
            <label className="block text-xs font-medium text-muted-foreground">
              <span className="mb-1 block">Label</span>
              <select
                value={currentLabelId}
                onChange={(e) => onLabelFilter(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
              >
                <option value="">All labels</option>
                {labelCatalog.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {whatsappConnections.length > 0 ? (
            <label className="block text-xs font-medium text-muted-foreground">
              <span className="mb-1 block">WhatsApp line</span>
              <select
                value={currentConnectionId}
                onChange={(e) => onConnectionFilter(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
              >
                <option value="">All lines</option>
                {whatsappConnections.map((conn) => (
                  <option key={conn.id} value={conn.id}>
                    {connectionSelectLabel(conn)}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label className="flex cursor-pointer items-center gap-2 py-0.5 text-xs text-muted-foreground hover:text-foreground">
            <input
              type="checkbox"
              checked={humanOnlyFilter}
              onChange={(e) => onHumanOnlyFilter(e.target.checked)}
              className="size-3.5 shrink-0 rounded border-border accent-primary"
              aria-label="Show only conversations in human handling"
            />
            <span>Human handling only</span>
          </label>
        </div>
      ) : null}
    </div>
  );
}
