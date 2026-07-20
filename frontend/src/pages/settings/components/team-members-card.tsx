import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InlineHelpHint } from "@/components/ui/inline-help-hint";
import { TeamMemberHandoffPhoneRow } from "@/pages/settings/components/team-member-handoff-phone-row";
import { TeamMemberHandoffPhoneSheet } from "@/pages/settings/components/team-member-handoff-phone-sheet";
import type { TeamMemberRecord, WhatsappConnection } from "@/types/repositories";

type Props = {
  members: TeamMemberRecord[];
  currentUserId: string | undefined;
  isOwner: boolean;
  connections: WhatsappConnection[];
  connectionPhoneDigits: readonly string[];
  onChanged: () => Promise<void>;
};

export function TeamMembersCard({
  members,
  currentUserId,
  isOwner,
  connections,
  connectionPhoneDigits,
  onChanged,
}: Props) {
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const selectedMember = useMemo(
    () => members.find((m) => m.userId === selectedUserId) ?? null,
    [members, selectedUserId],
  );

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2">
            Members
            <InlineHelpHint label="About handoff phones">
              <p>
                Use Manage to link a teammate&apos;s personal WhatsApp number to a business line so
                they can get handoff alerts for chats on that line.
              </p>
            </InlineHelpHint>
          </CardTitle>
        </CardHeader>
        <CardContent className="divide-y divide-border">
          {members.map((m) => {
            const canManage = Boolean(isOwner || (currentUserId && currentUserId === m.userId));
            return (
              <div
                key={m.id}
                className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{m.email || "Unknown member"}</p>
                  <p className="text-xs capitalize text-muted-foreground">{m.role}</p>
                </div>
                <TeamMemberHandoffPhoneRow
                  member={m}
                  canManage={canManage}
                  onOpen={() => setSelectedUserId(m.userId)}
                />
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
