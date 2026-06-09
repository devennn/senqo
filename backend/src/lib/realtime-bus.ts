import { EventEmitter } from "node:events";

/**
 * In-process realtime event bus for dashboard live updates.
 *
 * Conversation/message writes all funnel through a couple of repository
 * functions; those `publish()` a lightweight signal here, and the SSE route
 * (`routes/realtime.ts`) relays it to subscribed dashboards for the matching
 * workspace. Events are signal-only — the client refetches the real data — so we
 * never hydrate heavy shapes in the write path.
 *
 * This is in-process: it works because the backend runs as a single instance.
 * If the backend is ever horizontally scaled, swap this for Postgres
 * LISTEN/NOTIFY (or Redis pub/sub) behind the same `publish`/`subscribe` API.
 */

export type RealtimeEvent = {
  type: "message.created" | "conversation.created";
  conversationId: string;
};

type Listener = (event: RealtimeEvent) => void;

const emitter = new EventEmitter();
// One listener per connected dashboard tab — don't warn at 10.
emitter.setMaxListeners(0);

function channel(workspaceId: string): string {
  return `ws:${workspaceId}`;
}

/** Publish a realtime signal to all dashboards watching this workspace. Never throws. */
export function publish(workspaceId: string, event: RealtimeEvent): void {
  if (!workspaceId) return;
  try {
    emitter.emit(channel(workspaceId), event);
  } catch (error) {
    console.error(`[RealtimeBus/publish] ${String(error)}`);
  }
}

/** Subscribe to a workspace's events. Returns an unsubscribe function. */
export function subscribe(workspaceId: string, listener: Listener): () => void {
  const name = channel(workspaceId);
  emitter.on(name, listener);
  return () => {
    emitter.off(name, listener);
  };
}
