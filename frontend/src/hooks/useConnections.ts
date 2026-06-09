import { useState, useCallback, useEffect } from "react";
import { api } from "@/lib/api";
import { useWorkspace } from "@/context/workspace";
import type { WhatsappConnection, WhatsappConnectionEvent, WhatsappConnectionMode } from "@/types/repositories";

export type ConnectionUnavailableReason = "whatsapp_unavailable" | null;

const POLL_INTERVAL_MS = 5000;

export function useConnections() {
  const { workspaceId } = useWorkspace();
  const [connections, setConnections] = useState<WhatsappConnection[]>([]);
  const [events, setEvents] = useState<WhatsappConnectionEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [canCreateConnection, setCanCreateConnection] = useState(true);
  const [connectionUnavailableReason, setConnectionUnavailableReason] = useState<ConnectionUnavailableReason>(null);

  const reload = useCallback(async () => {
    const res = await api.get<{
      connections: WhatsappConnection[];
      events?: WhatsappConnectionEvent[];
      canCreateConnection?: boolean;
      connectionUnavailableReason?: ConnectionUnavailableReason;
    }>("/api/user/connections");
    setConnections(res.connections);
    setEvents(res.events ?? []);
    setCanCreateConnection(res.canCreateConnection ?? true);
    setConnectionUnavailableReason(res.connectionUnavailableReason ?? null);
    setLoading(false);
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  useEffect(() => {
    if (!workspaceId) return;
    const interval = setInterval(() => { void reload(); }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [workspaceId, reload]);

  const createConnection = useCallback(async (displayName: string) => {
    try {
      await api.post("/api/user/connections", { displayName });
      await reload();
    } catch (error) {
      if (error instanceof Error && error.message === "whatsapp_unavailable") {
        setCanCreateConnection(false);
        setConnectionUnavailableReason("whatsapp_unavailable");
      }
      throw error;
    }
  }, [reload]);

  const refreshQr = useCallback(async (id: string) => {
    await api.post(`/api/user/connections/${id}/refresh-qr`);
    await reload();
  }, [reload]);

  const reconnect = useCallback(async (id: string) => {
    await api.post(`/api/user/connections/${id}/reconnect`);
    await reload();
  }, [reload]);

  const updateMode = useCallback(async (id: string, mode: WhatsappConnectionMode) => {
    await api.patch(`/api/user/connections/${id}/mode`, { mode });
    await reload();
  }, [reload]);

  const updateDisplayName = useCallback(async (id: string, displayName: string) => {
    await api.patch(`/api/user/connections/${id}`, { displayName });
    await reload();
  }, [reload]);

  const deleteConnection = useCallback(async (id: string) => {
    await api.delete(`/api/user/connections/${id}`);
    await reload();
  }, [reload]);

  return {
    connections,
    events,
    loading,
    canCreateConnection,
    connectionUnavailableReason,
    reload,
    createConnection,
    refreshQr,
    reconnect,
    updateMode,
    updateDisplayName,
    deleteConnection,
  };
}
