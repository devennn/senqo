import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ConversationLabelBadge } from "@/types/repositories";

export function ConversationLabelBadges({
  labels,
  maxVisible = 3,
  className,
}: {
  labels: ConversationLabelBadge[];
  maxVisible?: number;
  className?: string;
}) {
  if (labels.length === 0) return null;
  const visible = labels.slice(0, maxVisible);
  const extra = labels.length - visible.length;
  return (
    <div className={cn("flex flex-wrap items-center gap-1", className)}>
      {visible.map((l) => (
        <Badge
          key={l.id}
          variant="secondary"
          title={l.source === "ai" ? "Applied by AI" : "Applied by you"}
          className="max-w-[9rem] truncate font-normal"
        >
          {l.name}
        </Badge>
      ))}
      {extra > 0 ? (
        <span className="text-[0.65rem] font-medium text-muted-foreground">+{extra}</span>
      ) : null}
    </div>
  );
}
