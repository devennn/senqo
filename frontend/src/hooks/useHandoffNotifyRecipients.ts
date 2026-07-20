import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { formatHandoffPhoneDisplay } from "@/lib/handoff-phone";
import type { TeamMemberRecord } from "@/types/repositories";
import type { HandoffNotifyRecipientOption } from "@/types/ui";

export function useHandoffNotifyRecipients(): HandoffNotifyRecipientOption[] {
  const [recipients, setRecipients] = useState<HandoffNotifyRecipientOption[]>([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await api.get<{ members: TeamMemberRecord[] }>("/api/user/team");
        if (cancelled) return;
        setRecipients(
          (res.members ?? [])
            .map((m) => {
              const verified = m.handoffPhones.filter((p) => p.status === "verified");
              if (verified.length === 0) return null;
              const phoneLabel = verified
                .map((p) => `${formatHandoffPhoneDisplay(p.phone)} via ${p.connectionName}`)
                .join("; ");
              return {
                userId: m.userId,
                email: m.email,
                phone: phoneLabel,
              };
            })
            .filter((r): r is HandoffNotifyRecipientOption => r !== null),
        );
      } catch {
        if (!cancelled) setRecipients([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return recipients;
}
