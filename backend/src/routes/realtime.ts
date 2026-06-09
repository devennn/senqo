import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { verifyToken } from "../lib/auth-jwt.js";
import { validateWorkspaceMembership } from "../repositories/workspaces.js";
import { subscribe, type RealtimeEvent } from "../lib/realtime-bus.js";

const app = new Hono();

const HEARTBEAT_MS = 25_000;

/**
 * Server-Sent Events stream for the dashboard.
 *
 * `GET /api/realtime/stream?token=<jwt>&workspaceId=<id>`
 *
 * This route is mounted OUTSIDE the `/api/user` group because that group's auth
 * reads `Authorization: Bearer`, which an `EventSource` cannot set. Instead the
 * short-lived access token rides in the query string (same-origin, HTTPS in
 * prod). Events are signal-only; the client refetches the affected data.
 */
app.get("/stream", async (c) => {
  const token = c.req.query("token") ?? "";
  const workspaceId = c.req.query("workspaceId")?.trim() ?? "";
  if (!token || !workspaceId) {
    return c.json({ error: "missing token or workspaceId" }, 400);
  }

  const auth = await verifyToken(token);
  if (!auth) return c.json({ error: "unauthorized" }, 401);

  const isMember = await validateWorkspaceMembership(workspaceId, auth.userId);
  if (!isMember) return c.json({ error: "forbidden" }, 403);

  // Defeat proxy buffering (nginx honours this header) so events flush immediately.
  c.header("X-Accel-Buffering", "no");
  c.header("Cache-Control", "no-cache, no-transform");
  c.header("Connection", "keep-alive");

  return streamSSE(c, async (stream) => {
    let open = true;
    const queue: RealtimeEvent[] = [];
    let notify: (() => void) | null = null;

    const unsubscribe = subscribe(workspaceId, (event) => {
      queue.push(event);
      notify?.();
    });

    stream.onAbort(() => {
      open = false;
      unsubscribe();
      notify?.();
    });

    await stream.writeSSE({ event: "ready", data: JSON.stringify({ workspaceId }) });

    let lastBeat = Date.now();
    while (open) {
      // Drain any queued events.
      while (queue.length > 0) {
        const event = queue.shift() as RealtimeEvent;
        await stream.writeSSE({ event: event.type, data: JSON.stringify(event) });
      }
      // Heartbeat keeps the connection (and intermediaries) alive.
      if (Date.now() - lastBeat >= HEARTBEAT_MS) {
        await stream.writeSSE({ event: "ping", data: String(Date.now()) });
        lastBeat = Date.now();
      }
      // Wait for the next event or the heartbeat interval, whichever comes first.
      await new Promise<void>((resolve) => {
        notify = resolve;
        const timer = setTimeout(resolve, HEARTBEAT_MS);
        // Ensure the timer doesn't keep the event loop alive past abort.
        timer.unref?.();
      });
      notify = null;
    }

    unsubscribe();
  });
});

export default app;
