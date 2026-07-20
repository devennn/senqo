import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import {
  isHandoffPhoneAConnection,
  isHandoffPhoneValid,
  normalizeHandoffPhoneDigits,
} from "@/lib/handoff-phone";
import type { TeamMemberHandoffPhone, TeamMemberRecord, WhatsappConnection } from "@/types/repositories";

function isAuthorized(c: WhatsappConnection): boolean {
  return c.status === "authorized" || c.last_state_instance === "authorized";
}

export function useTeamMemberHandoffPhone(input: {
  member: TeamMemberRecord;
  connections: WhatsappConnection[];
  connectionPhoneDigits: readonly string[];
  onChanged: () => Promise<void>;
}) {
  const { member, connections, connectionPhoneDigits, onChanged } = input;
  const authorized = useMemo(() => connections.filter(isAuthorized), [connections]);
  const registeredIds = new Set(member.handoffPhones.map((p) => p.connectionId));
  const available = authorized.filter((c) => !registeredIds.has(c.id));

  const [connectionId, setConnectionId] = useState(available[0]?.id ?? "");
  const [phoneDigits, setPhoneDigits] = useState("");
  const [codeByConnection, setCodeByConnection] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!available.some((c) => c.id === connectionId)) {
      setConnectionId(available[0]?.id ?? "");
    }
  }, [available, connectionId]);

  const phoneValid = isHandoffPhoneValid(phoneDigits);
  const phoneIsConnection = isHandoffPhoneAConnection(phoneDigits, connectionPhoneDigits);
  const canRegister = Boolean(connectionId) && phoneValid && !phoneIsConnection && !busy;

  async function register(nextPhone: string, nextConnectionId: string) {
    if (!nextConnectionId) {
      setError("invalid_connection");
      return;
    }
    if (isHandoffPhoneAConnection(nextPhone, connectionPhoneDigits)) {
      setError("phone_is_connection");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.post("/api/user/team/handoff-phone", {
        userId: member.userId,
        phone: nextPhone,
        whatsappConnectionId: nextConnectionId,
      });
      setPhoneDigits("");
      await onChanged();
    } catch (err) {
      setError(String((err as Error).message));
    } finally {
      setBusy(false);
    }
  }

  async function confirm(entry: TeamMemberHandoffPhone) {
    setBusy(true);
    setError(null);
    try {
      await api.post("/api/user/team/handoff-phone/confirm", {
        userId: member.userId,
        whatsappConnectionId: entry.connectionId,
        code: (codeByConnection[entry.connectionId] ?? "").trim(),
      });
      setCodeByConnection((prev) => ({ ...prev, [entry.connectionId]: "" }));
      await onChanged();
    } catch (err) {
      setError(String((err as Error).message));
    } finally {
      setBusy(false);
    }
  }

  async function clearPhone(entry: TeamMemberHandoffPhone) {
    setBusy(true);
    setError(null);
    try {
      await api.delete("/api/user/team/handoff-phone", {
        body: JSON.stringify({
          userId: member.userId,
          whatsappConnectionId: entry.connectionId,
        }),
      });
      await onChanged();
    } catch (err) {
      setError(String((err as Error).message));
    } finally {
      setBusy(false);
    }
  }

  return {
    authorized,
    available,
    connectionId,
    phoneDigits,
    codeByConnection,
    busy,
    error,
    phoneIsConnection,
    canRegister,
    setError,
    setConnectionId,
    setPhoneDigits,
    setCodeByConnection,
    register,
    confirm,
    clearPhone,
    resend: (entry: TeamMemberHandoffPhone) =>
      register(normalizeHandoffPhoneDigits(entry.phone), entry.connectionId),
  };
}
