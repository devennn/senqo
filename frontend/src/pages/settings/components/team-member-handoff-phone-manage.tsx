import { teamMemberErrorMessage } from "@/lib/team-member-errors";
import { TeamMemberHandoffPhoneEntry } from "@/pages/settings/components/team-member-handoff-phone-entry";
import { TeamMemberHandoffPhoneRegister } from "@/pages/settings/components/team-member-handoff-phone-register";
import { useTeamMemberHandoffPhone } from "@/pages/settings/components/use-team-member-handoff-phone";
import type { TeamMemberRecord, WhatsappConnection } from "@/types/repositories";

type Props = {
  member: TeamMemberRecord;
  connections: WhatsappConnection[];
  connectionPhoneDigits: readonly string[];
  onChanged: () => Promise<void>;
};

export function TeamMemberHandoffPhoneManage({
  member,
  connections,
  connectionPhoneDigits,
  onChanged,
}: Props) {
  const state = useTeamMemberHandoffPhone({
    member,
    connections,
    connectionPhoneDigits,
    onChanged,
  });

  return (
    <div className="flex w-full flex-col gap-4">
      {state.error ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {teamMemberErrorMessage(state.error)}
        </p>
      ) : null}

      {member.handoffPhones.map((entry) => (
        <TeamMemberHandoffPhoneEntry
          key={entry.connectionId}
          memberUserId={member.userId}
          entry={entry}
          code={state.codeByConnection[entry.connectionId] ?? ""}
          busy={state.busy}
          onCodeChange={(value) => {
            state.setError(null);
            state.setCodeByConnection((prev) => ({ ...prev, [entry.connectionId]: value }));
          }}
          onConfirm={() => void state.confirm(entry)}
          onResend={() => void state.resend(entry)}
          onRemove={() => void state.clearPhone(entry)}
        />
      ))}

      {state.available.length > 0 ? (
        <div className={member.handoffPhones.length > 0 ? "space-y-3 pt-4" : "space-y-3"}>
          {member.handoffPhones.length > 0 ? (
            <p className="text-sm font-medium">Add another line</p>
          ) : null}
          <TeamMemberHandoffPhoneRegister
            userId={member.userId}
            connections={state.available}
            connectionId={state.connectionId}
            phoneDigits={state.phoneDigits}
            busy={state.busy}
            phoneIsConnection={state.phoneIsConnection}
            canRegister={state.canRegister}
            onConnectionIdChange={(id) => {
              state.setError(null);
              state.setConnectionId(id);
            }}
            onPhoneDigitsChange={(digits) => {
              state.setError(null);
              state.setPhoneDigits(digits);
            }}
            onRegister={() => void state.register(state.phoneDigits, state.connectionId)}
          />
        </div>
      ) : state.authorized.length === 0 ? (
        <p className="text-xs text-muted-foreground">Connect a WhatsApp line first.</p>
      ) : null}
    </div>
  );
}
