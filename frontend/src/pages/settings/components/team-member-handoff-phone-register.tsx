import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { HandoffPhoneInput } from "@/pages/settings/components/handoff-phone-input";
import { teamMemberErrorMessage } from "@/lib/team-member-errors";
import type { WhatsappConnection } from "@/types/repositories";

type Props = {
  userId: string;
  connections: WhatsappConnection[];
  connectionId: string;
  phoneDigits: string;
  busy: boolean;
  phoneIsConnection: boolean;
  canRegister: boolean;
  onConnectionIdChange: (id: string) => void;
  onPhoneDigitsChange: (digits: string) => void;
  onRegister: () => void;
};

function connectionLabel(c: WhatsappConnection): string {
  return c.display_name?.trim() || c.phone_number?.trim() || c.id;
}

export function TeamMemberHandoffPhoneRegister({
  userId,
  connections,
  connectionId,
  phoneDigits,
  busy,
  phoneIsConnection,
  canRegister,
  onConnectionIdChange,
  onPhoneDigitsChange,
  onRegister,
}: Props) {
  return (
    <div className="flex flex-col gap-3">
      <div className="space-y-1.5">
        <Label htmlFor={`handoff-line-${userId}`}>WhatsApp line</Label>
        <select
          id={`handoff-line-${userId}`}
          value={connectionId}
          onChange={(e) => onConnectionIdChange(e.target.value)}
          disabled={busy}
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
        >
          {connections.map((c) => (
            <option key={c.id} value={c.id}>
              {connectionLabel(c)}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`handoff-phone-${userId}`}>Personal number</Label>
        <HandoffPhoneInput
          id={`handoff-phone-${userId}`}
          valueDigits={phoneDigits}
          disabled={busy}
          invalid={phoneIsConnection}
          onDigitsChange={onPhoneDigitsChange}
        />
        <Button type="button" size="sm" className="w-fit" disabled={!canRegister} onClick={onRegister}>
          Send code
        </Button>
      </div>
      {phoneIsConnection ? (
        <p className="text-xs text-destructive">{teamMemberErrorMessage("phone_is_connection")}</p>
      ) : null}
    </div>
  );
}
