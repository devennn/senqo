import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { randomBytes } from "node:crypto";
import { verifyToken } from "../lib/auth-jwt.js";
import { validateWorkspaceMembership } from "../repositories/workspaces.js";
import { subscribe, type RealtimeEvent } from "../lib/realtime-bus.js";

const app = new Hono();

const HEARTBEAT_MS = 25_000;

/**
 * Single-use stream tickets. The dashboard exchanges its access token for one via
 * `POST /api/realtime/ticket` and opens the SSE stream with it, so no reusable
 * credential (and nothing worth logging) ever rides in the URL.
 */
export const REALTIME_TICKET_TTL_MS = 30_000;
const MAX_TICKETS = 10_000;

type RealtimeTicket = {
  workspaceId: string;
  expiresAt: number;
};

const tickets = new Map<string, RealtimeTicket>();

/** Keeps the ticket map bounded; expired entries first, then oldest issuance. */
function evictTickets(now: number): void {
  if (tickets.size <= MAX_TICKETS) return;
  for (const [ticket, entry] of tickets.entries()) {
    if (entry.expiresAt <= now) tickets.delete(ticket);
  }
  while (tickets.size > MAX_TICKETS) {
    const oldest = tickets.keys().next().value;
    if (oldest === undefined) return;
    tickets.delete(oldest);
  }
}

function issueTicket(workspaceId: string, now: number): string {
  evictTickets(now);
  const ticket = randomBytes(24).toString("base64url");
  tickets.set(ticket, { workspaceId, expiresAt: now + REALTIME_TICKET_TTL_MS });
  return ticket;
}

/** Consumes a ticket exactly once: invalid after use, expiry, or a workspace mismatch. */
function consumeTicket(ticket: string, workspaceId: string): boolean {
  const entry = tickets.get(ticket);
  if (!entry) return false;
  tickets.delete(ticket);
  return entry.expiresAt > Date.now() && entry.workspaceId === workspaceId;
}

/**
 * Exchanges an `Authorization: Bearer` access token for a single-use stream ticket.
 * Workspace membership is enforced here, at ticket issuance.
 */
app.post("/ticket", async (c) => {
  const token = (c.req.header("Authorization") ?? "").replace("Bearer ", "").trim();
  if (!token) return c.json({ error: "unauthorized" }, 401);

  const body = (await c.req.json().catch(() => null)) as { workspaceId?: unknown } | null;
  const workspaceId = typeof body?.workspaceId === "string" ? body.workspaceId.trim() : "";
  if (!workspaceId) return c.json({ error: "missing workspaceId" }, 400);

  const auth = await verifyToken(token);
  if (!auth) return c.json({ error: "unauthorized" }, 401);

  const isMember = await validateWorkspaceMembership(workspaceId, auth.userId);
  if (!isMember) return c.json({ error: "forbidden" }, 403);

  return c.json({ ticket: issueTicket(workspaceId, Date.now()) });
});

/**
 * Server-Sent Events stream for the dashboard.
 *
 * `GET /api/realtime/stream?ticket=<single-use-ticket>&workspaceId=<id>`
 *
 * This route is mounted OUTSIDE the `/api/user` group because that group's auth
 * reads `Authorization: Bearer`, which an `EventSource` cannot set. The ticket is
 * single-use and short-lived, so leaking it (logs, history) cannot be replayed.
 * Events are signal-only; the client refetches the affected data.
 */
app.get("/stream", async (c) => {
  const ticket = c.req.query("ticket")?.trim() ?? "";
  const workspaceId = c.req.query("workspaceId")?.trim() ?? "";
  if (!ticket || !workspaceId) {
    return c.json({ error: "missing ticket or workspaceId" }, 400);
  }

  if (!consumeTicket(ticket, workspaceId)) {
    return c.json({ error: "unauthorized" }, 401);
  }

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
