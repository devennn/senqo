import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { InlineHelpHint } from "@/components/ui/inline-help-hint";
import { TeamMemberHandoffPhoneManage } from "@/pages/settings/components/team-member-handoff-phone-manage";
import type { TeamMemberRecord, WhatsappConnection } from "@/types/repositories";

type Props = {
  member: TeamMemberRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  connections: WhatsappConnection[];
  connectionPhoneDigits: readonly string[];
  onChanged: () => Promise<void>;
};

export function TeamMemberHandoffPhoneSheet({
  member,
  open,
  onOpenChange,
  connections,
  connectionPhoneDigits,
  onChanged,
}: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 overflow-y-auto rounded-none p-0 sm:max-w-md">
        <SheetHeader className="border-b border-border/60 pr-12">
          <SheetTitle className="flex flex-wrap items-center gap-2">
            Handoff phone
            <InlineHelpHint label="About handoff phone">
              <p>
                Link a personal WhatsApp number to a business line. We text a code from that line to
                confirm it. Later handoff alerts for chats on that line go to this number.
              </p>
            </InlineHelpHint>
          </SheetTitle>
          <SheetDescription>
            {member?.email ? `For ${member.email}` : "Link a personal number to a WhatsApp line."}
          </SheetDescription>
        </SheetHeader>
        <div className="p-4">
          {member ? (
            <TeamMemberHandoffPhoneManage
              key={`${member.userId}:${member.handoffPhones.map((p) => `${p.connectionId}:${p.status}`).join(",")}`}
              member={member}
              connections={connections}
              connectionPhoneDigits={connectionPhoneDigits}
              onChanged={onChanged}
            />
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
