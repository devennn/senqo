import { randomUUID } from "node:crypto";
import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { eq, sql } from "drizzle-orm";
import { loadRepoDatabaseUrl } from "../lib/load-repo-env.js";

loadRepoDatabaseUrl();
const databaseUrl = process.env.DATABASE_URL ?? "";
if (databaseUrl.includes("@postgres:")) {
  process.env.DATABASE_URL = databaseUrl.replace("@postgres:", "@127.0.0.1:");
}

const { db } = await import("../db/index.js");
const { users, workspaces, whatsappConnections } = await import("../db/schema/index.js");
const { markConnectionDisconnected } = await import("./whatsapp.js");

const userId = randomUUID();
const workspaceId = randomUUID();
const connectionId = randomUUID();

async function dbAvailable(): Promise<boolean> {
  try {
    await db.execute(sql`select 1`);
    return true;
  } catch {
    return false;
  }
}

const hasDb = await dbAvailable();

async function cleanup(): Promise<void> {
  await db.delete(whatsappConnections).where(eq(whatsappConnections.workspaceId, workspaceId));
  await db.delete(workspaces).where(eq(workspaces.id, workspaceId));
  await db.delete(users).where(eq(users.id, userId));
}

afterAll(async () => {
  await cleanup();
});

describe.skipIf(!hasDb)("markConnectionDisconnected (real DB)", () => {
  beforeAll(async () => {
    await cleanup();

    await db.insert(users).values({
      id: userId,
      email: `wa-state-it-${userId.slice(0, 8)}@example.com`,
    });
    await db.insert(workspaces).values({
      id: workspaceId,
      name: "WA State IT Workspace",
      ownerUserId: userId,
    });
    await db.insert(whatsappConnections).values({
      id: connectionId,
      workspaceId,
      displayName: "Line IT",
      status: "authorized",
      lastStateInstance: "authorized",
      qrCodePayload: "data:image/png;base64,stale",
      phoneNumber: "60111111111",
      waAvatarUrl: "https://example.com/avatar.png",
      waDeviceId: "device-1",
    });
  });

  // The card reads last_state_instance first: both status and last_state_instance must stop saying
  // "authorized", while the saved number, avatar, and device id stay for the Reconnect flow.
  it("flips the row to not authorized and preserves saved display fields", async () => {
    const result = await markConnectionDisconnected(workspaceId, connectionId);

    expect(result).toEqual({ ok: true });

    const rows = await db
      .select()
      .from(whatsappConnections)
      .where(eq(whatsappConnections.id, connectionId));
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("not_authorized");
    expect(rows[0].lastStateInstance).toBe("notAuthorized");
    expect(rows[0].qrCodePayload).toBeNull();
    expect(rows[0].phoneNumber).toBe("60111111111");
    expect(rows[0].waAvatarUrl).toBe("https://example.com/avatar.png");
    expect(rows[0].waDeviceId).toBe("device-1");
  });
});
