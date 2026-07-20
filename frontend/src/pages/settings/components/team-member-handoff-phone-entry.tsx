import { formatHandoffPhoneDisplay } from "@/lib/handoff-phone";
import { Button } from "@/components/ui/button";
import { TeamMemberHandoffPhonePending } from "@/pages/settings/components/team-member-handoff-phone-pending";
import type { TeamMemberHandoffPhone } from "@/types/repositories";

type Props = {
  memberUserId: string;
  entry: TeamMemberHandoffPhone;
  code: string;
  busy: boolean;
  onCodeChange: (value: string) => void;
  onConfirm: () => void;
  onResend: () => void;
  onRemove: () => void;
};

export function TeamMemberHandoffPhoneEntry({
  memberUserId,
  entry,
  code,
  busy,
  onCodeChange,
  onConfirm,
  onResend,
  onRemove,
}: Props) {
  if (entry.status === "pending") {
    return (
      <TeamMemberHandoffPhonePending
        userId={`${memberUserId}-${entry.connectionId}`}
        phone={formatHandoffPhoneDisplay(entry.phone)}
        connectionName={entry.connectionName}
        code={code}
        busy={busy}
        onCodeChange={onCodeChange}
        onConfirm={onConfirm}
        onResend={onResend}
        onChangeNumber={onRemove}
      />
    );
  }
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="min-w-0 space-y-0.5">
        <p className="text-sm tabular-nums">{formatHandoffPhoneDisplay(entry.phone)}</p>
        <p className="text-xs text-muted-foreground">Alerts from {entry.connectionName}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-md bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">
          Verified
        </span>
        <Button type="button" size="sm" variant="destructive" disabled={busy} onClick={onRemove}>
          Remove
        </Button>
      </div>
    </div>
  );
}
