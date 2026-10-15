import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { formatHandoffPhoneDisplay } from "@/lib/handoff-phone";
import type { TeamMemberRecord } from "@/types/repositories";
import type {
  HandoffNotifyMemberLookup,
  HandoffNotifyRecipientOption,
  HandoffNotifyRecipientsState,
} from "@/types/ui";

const initialState: HandoffNotifyRecipientsState = {
  recipients: [],
  membersById: new Map(),
  status: "loading",
};

/**
 * Verified teammates for the notify list, plus a lookup of every teammate so stored
 * selections without a verified phone can be labeled and removed in the dialog.
 */
export function useHandoffNotifyRecipients(): HandoffNotifyRecipientsState {
  const [state, setState] = useState<HandoffNotifyRecipientsState>(initialState);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await api.get<{ members: TeamMemberRecord[] }>("/api/user/team");
        if (cancelled) return;
        const members = res.members ?? [];
        const membersById = new Map<string, HandoffNotifyMemberLookup>();
        const recipients: HandoffNotifyRecipientOption[] = [];
        for (const member of members) {
          membersById.set(member.userId, { email: member.email });
          const verified = member.handoffPhones.filter((p) => p.status === "verified");
          if (verified.length === 0) continue;
          const phoneLabel = verified
            .map((p) => `${formatHandoffPhoneDisplay(p.phone)} via ${p.connectionName}`)
            .join("; ");
          recipients.push({
            userId: member.userId,
            email: member.email,
            phone: phoneLabel,
          });
        }
        setState({ recipients, membersById, status: "ready" });
      } catch {
        if (!cancelled) {
          setState({ recipients: [], membersById: new Map(), status: "error" });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
