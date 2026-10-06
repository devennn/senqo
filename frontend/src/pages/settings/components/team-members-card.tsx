import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InlineHelpHint } from "@/components/ui/inline-help-hint";
import { TeamMemberHandoffPhoneRow } from "@/pages/settings/components/team-member-handoff-phone-row";
import { TeamMemberHandoffPhoneSheet } from "@/pages/settings/components/team-member-handoff-phone-sheet";
import { TeamMemberErrorAlertsToggle } from "@/pages/settings/components/team-member-error-alerts-toggle";
import { TeamMemberRoleControl } from "@/pages/settings/components/team-member-role-control";
import type { TeamMemberRecord, WhatsappConnection } from "@/types/repositories";

type Props = {
  members: TeamMemberRecord[];
  currentUserId: string | undefined;
  actorRole: "owner" | "admin" | "member" | null;
  connections: WhatsappConnection[];
  connectionPhoneDigits: readonly string[];
  onChanged: () => Promise<void>;
};

export function TeamMembersCard({
  members,
  currentUserId,
  actorRole,
  connections,
  connectionPhoneDigits,
  onChanged,
}: Props) {
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const selectedMember = useMemo(
    () => members.find((m) => m.userId === selectedUserId) ?? null,
    [members, selectedUserId],
  );
  const canManageTeam = actorRole === "owner" || actorRole === "admin";

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2">
            Members
            <InlineHelpHint label="About handoff phones">
              <p>
                Use Manage to link a teammate&apos;s personal WhatsApp number to a business
                line so they can get handoff alerts for chats on that line. Tick Receive AI
                error alerts to also alert them when an internal AI error prevents a reply
                to a customer on a line where they have a verified phone.
              </p>
            </InlineHelpHint>
          </CardTitle>
        </CardHeader>
        <CardContent className="divide-y divide-border">
          {members.map((m) => {
            const isSelf = Boolean(currentUserId && currentUserId === m.userId);
            const canManageHandoff = canManageTeam || isSelf;
            const canManageAlerts = actorRole === "owner" || isSelf;
            return (
              <div
                key={m.id}
                className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium" title={m.email ?? undefined}>
                    {m.email || "Unknown member"}
                  </p>
                </div>
                <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 sm:justify-end">
                  <TeamMemberRoleControl
                    member={m}
                    actorRole={actorRole}
                    onChanged={onChanged}
                  />
                  <TeamMemberErrorAlertsToggle
                    member={m}
                    canManage={canManageAlerts}
                    onChanged={onChanged}
                  />
                  <span aria-hidden className="hidden h-5 w-px shrink-0 bg-border sm:block" />
                  <TeamMemberHandoffPhoneRow
                    member={m}
                    canManage={canManageHandoff}
                    onOpen={() => setSelectedUserId(m.userId)}
                  />
                </div>
              </div>
            );
          })}
          {members.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">No team members yet.</p>
          ) : null}
        </CardContent>
      </Card>

      <TeamMemberHandoffPhoneSheet
        member={selectedMember}
        open={selectedUserId !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedUserId(null);
        }}
        connections={connections}
        connectionPhoneDigits={connectionPhoneDigits}
        onChanged={onChanged}
      />
    </>
  );
}
