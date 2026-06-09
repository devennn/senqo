import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { WhatsappConnection } from "@/types/repositories";

/** Loads workspace WhatsApp connections for the inbox filter dropdown. */
export function useWhatsappConnectionsForInboxFilters() {
  const [connections, setConnections] = useState<WhatsappConnection[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    void api
      .get<{ connections: WhatsappConnection[] }>("/api/user/connections")
      .then((res) => {
        if (!mounted) return;
        const list = res.connections ?? [];
        setConnections(
          [...list].sort((a, b) => a.display_name.localeCompare(b.display_name, undefined, { sensitivity: "base" })),
        );
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  return { connections, loading };
}
