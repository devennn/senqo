import { Link } from "react-router-dom";
import { Label } from "@/components/ui/label";
import type { HandoffNotifyRecipientOption } from "@/types/ui";

type Props = {
  recipients: HandoffNotifyRecipientOption[];
  selectedIds: ReadonlySet<string>;
  disabled?: boolean;
  onToggle: (userId: string, checked: boolean) => void;
};

export function AgentHandoffNotifyField({
  recipients,
  selectedIds,
  disabled,
  onToggle,
}: Props) {
  return (
    <div className="min-w-0 space-y-2">
      <Label>Notify on handoff</Label>
      {recipients.length > 0 ? (
        <div className="grid min-w-0 gap-2">
          {recipients.map((r) => {
            const label = r.email || r.phone;
            const fullText = `${label} (${r.phone})`;
            return (
              <label
                key={r.userId}
                className="flex min-w-0 max-w-full items-start gap-2 overflow-hidden rounded-md border border-border/70 px-3 py-2 text-sm"
              >
                <input
                  type="checkbox"
                  className="mt-0.5 shrink-0"
                  checked={selectedIds.has(r.userId)}
                  disabled={disabled}
                  onChange={(e) => onToggle(r.userId, e.target.checked)}
                />
                <span className="min-w-0 flex-1 line-clamp-2 break-words" title={fullText}>
                  <span className="font-medium">{label}</span>
                  <span className="text-muted-foreground"> ({r.phone})</span>
                </span>
              </label>
            );
          })}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          No verified handoff phones yet. Add one on{" "}
          <Link
            to="/settings/team"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Settings → Team
          </Link>
          .
        </p>
      )}
    </div>
  );
}
