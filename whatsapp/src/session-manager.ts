import { mkdir, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { env } from "./env.js";
import { logger } from "./logger.js";
import { BaileysSession } from "./baileys-session.js";

const sessions = new Map<string, BaileysSession>();
const CONNECTION_KEEPER_INTERVAL_MS = 30 * 60 * 1000;

/** Get an existing session or create (but do not start) a new one. */
export function getOrCreate(connectionId: string): BaileysSession {
  let session = sessions.get(connectionId);
  if (!session) {
    session = new BaileysSession(connectionId);
    sessions.set(connectionId, session);
  }
  return session;
}

export function get(connectionId: string): BaileysSession | undefined {
  return sessions.get(connectionId);
}

/** Start a session (idempotent). */
export async function startSession(connectionId: string): Promise<BaileysSession> {
  const session = getOrCreate(connectionId);
  await session.start();
  return session;
}

export async function removeSession(connectionId: string): Promise<void> {
  const session = sessions.get(connectionId);
  if (session) {
    await session.destroy();
    sessions.delete(connectionId);
  }
}

/**
 * On boot, re-initialize every session whose auth state is on disk so authorized
 * numbers reconnect automatically and keep receiving messages without a new QR.
 */
export async function reviveSessions(): Promise<void> {
  await mkdir(env.sessionsDir, { recursive: true });
  let entries: string[];
  try {
    entries = await readdir(env.sessionsDir);
  } catch (error) {
    logger.warn({ error: String(error) }, "could not read sessions dir");
    return;
  }
  const ids: string[] = [];
  for (const entry of entries) {
    const full = path.join(env.sessionsDir, entry);
    try {
      const s = await stat(full);
      if (s.isDirectory()) ids.push(entry);
    } catch {
      /* ignore */
    }
  }
  logger.info({ count: ids.length }, "reviving persisted sessions");
  for (const id of ids) {
    // Start sequentially so we don't hammer WhatsApp on boot.
    await startSession(id).catch((error) =>
      logger.error({ connectionId: id, error: String(error) }, "revive failed"),
    );
  }
}

export function stopAll(): void {
  for (const session of sessions.values()) session.stop();
}

/**
 * Best-effort safety net: periodically re-attempt session starts for any
 * persisted auth directories. This complements Baileys' built-in reconnect logic
 * (which only applies after a socket was successfully created).
 */
export function startConnectionKeeper(): void {
  setInterval(() => {
    void reviveSessions().catch((error) => {
      logger.warn({ error: String(error) }, "connection keeper revive failed");
    });
  }, CONNECTION_KEEPER_INTERVAL_MS);
}
