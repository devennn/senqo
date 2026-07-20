import { formatHandoffPhoneDisplay } from "@/lib/handoff-phone";
import { Button } from "@/components/ui/button";
import type { TeamMemberRecord } from "@/types/repositories";

type Props = {
  member: TeamMemberRecord;
  canManage: boolean;
  onOpen: () => void;
};

function summaryLabel(member: TeamMemberRecord): string {
  const phones = member.handoffPhones;
  if (phones.length === 0) return "No handoff phone";
  const verified = phones.filter((p) => p.status === "verified").length;
  const pending = phones.filter((p) => p.status === "pending").length;
  if (verified > 0 && pending === 0) {
    return verified === 1
      ? formatHandoffPhoneDisplay(phones.find((p) => p.status === "verified")!.phone)
      : `${verified} verified`;
  }
  if (pending > 0 && verified === 0) {
    return pending === 1 ? "Pending confirmation" : `${pending} pending`;
  }
  return `${verified} verified, ${pending} pending`;
}

export function TeamMemberHandoffPhoneRow({ member, canManage, onOpen }: Props) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <p className="text-xs text-muted-foreground tabular-nums">{summaryLabel(member)}</p>
      {canManage ? (
        <Button type="button" size="sm" variant="outline" onClick={onOpen}>
          Manage
        </Button>
      ) : null}
    </div>
  );
}
