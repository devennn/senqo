import { useEffect, useRef } from "react";
import { getAccessToken } from "@/lib/auth-client";

export type RealtimeEvent = {
  type: "message.created" | "conversation.created";
  conversationId: string;
};

const apiBaseUrl = (
  (import.meta.env as Record<string, string | undefined>).VITE_API_BASE_URL ?? ""
).replace(/\/$/, "");

function buildStreamUrl(workspaceId: string, token: string): string {
  const base = apiBaseUrl || "";
  const params = new URLSearchParams({ workspaceId, token });
  return `${base}/api/realtime/stream?${params.toString()}`;
}

/**
 * Opens an SSE connection to the backend realtime stream and calls `onEvent`
 * for every push. Reconnects automatically with backoff on transient errors;
 * fetches a fresh access token on each reconnect so expiry is handled.
 *
 * Mounted at the workspace level — live even when no conversation is open,
 * so new conversations appear in the list instantly without a tab open.
 */
export function useRealtime(
  workspaceId: string | null,
  onEvent: (event: RealtimeEvent) => void,
): void {
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    if (!workspaceId) return;
    let es: EventSource | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;
    let stopped = false;

    async function connect() {
      if (stopped) return;
      const token = await getAccessToken().catch(() => null);
      if (!token || stopped) return;

      const url = buildStreamUrl(workspaceId!, token);
      es = new EventSource(url);

      es.addEventListener("message.created", (e: MessageEvent) => {
        attempt = 0;
        try {
          const data = JSON.parse(e.data as string) as RealtimeEvent;
          onEventRef.current(data);
        } catch { /* ignore malformed */ }
      });

      es.addEventListener("conversation.created", (e: MessageEvent) => {
        attempt = 0;
        try {
          const data = JSON.parse(e.data as string) as RealtimeEvent;
          onEventRef.current(data);
        } catch { /* ignore malformed */ }
      });

      // "ready" confirms the connection is authenticated and live.
      es.addEventListener("ready", () => { attempt = 0; });

      es.onerror = () => {
        es?.close();
        es = null;
        if (stopped) return;
        // Exponential backoff: 1s, 2s, 4s, 8s, capped at 30s.
        const delay = Math.min(30_000, 1_000 * 2 ** attempt);
        attempt += 1;
        retryTimer = setTimeout(() => { void connect(); }, delay);
      };
    }

    void connect();

    return () => {
      stopped = true;
      if (retryTimer !== null) clearTimeout(retryTimer);
      es?.close();
    };
  }, [workspaceId]);
}
