import { Link } from "react-router-dom";
import { Label } from "@/components/ui/label";
import type {
  HandoffNotifyRecipientOption,
  HandoffNotifyTeammateStatus,
  HandoffNotifyUnavailableOption,
} from "@/types/ui";

type Props = {
  recipients: HandoffNotifyRecipientOption[];
  unavailable: HandoffNotifyUnavailableOption[];
  status: HandoffNotifyTeammateStatus;
  selectedIds: ReadonlySet<string>;
  disabled?: boolean;
  onToggle: (userId: string, checked: boolean) => void;
};

const UNAVAILABLE_REASON_LABEL: Record<HandoffNotifyUnavailableOption["reason"], string> = {
  not_verified: "No verified phone",
  not_member: "Not in this workspace",
};

export function AgentHandoffNotifyField({
  recipients,
  unavailable,
  status,
  selectedIds,
  disabled,
  onToggle,
}: Props) {
  const hasRows = recipients.length > 0 || unavailable.length > 0;
  return (
    <div className="min-w-0 space-y-2">
      <Label>Notify on handoff</Label>
      {status === "loading" ? (
        <p className="text-xs text-muted-foreground">Loading teammates…</p>
      ) : status === "error" ? (
        <p className="text-xs text-muted-foreground">
          Couldn’t load teammates. Reload the page to check notify people.
        </p>
      ) : hasRows ? (
        <div className="grid min-w-0 gap-2">
          {unavailable.map((r) => {
            const label = r.email || "Unknown teammate";
            const hint = UNAVAILABLE_REASON_LABEL[r.reason];
            return (
              <label
                key={r.userId}
                className="flex min-w-0 max-w-full items-start gap-2 overflow-hidden rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm"
              >
                <input
                  type="checkbox"
                  className="mt-0.5 shrink-0"
                  checked={selectedIds.has(r.userId)}
                  disabled={disabled}
                  onChange={(e) => onToggle(r.userId, e.target.checked)}
                />
                <span className="min-w-0 flex-1 line-clamp-2 break-words" title={`${label} — ${hint}`}>
                  <span className="font-medium">{label}</span>
                  <span className="text-destructive"> — {hint} · uncheck to remove</span>
                </span>
              </label>
            );
          })}
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
