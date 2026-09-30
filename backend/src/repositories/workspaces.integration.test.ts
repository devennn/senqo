import { randomUUID } from "node:crypto";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq, sql } from "drizzle-orm";
import { loadRepoDatabaseUrl } from "../lib/load-repo-env.js";

loadRepoDatabaseUrl();
const databaseUrl = process.env.DATABASE_URL ?? "";
if (databaseUrl.includes("@postgres:")) {
  process.env.DATABASE_URL = databaseUrl.replace("@postgres:", "@127.0.0.1:");
}

const { db } = await import("../db/index.js");
const { users, workspaces } = await import("../db/schema/index.js");
const { getWorkspaceTimeZone, updateWorkspaceSettingsAsOwner } = await import(
  "./workspaces.js"
);

const ownerId = randomUUID();
const memberId = randomUUID();
const workspaceId = randomUUID();
const missingWorkspaceId = randomUUID();

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
  await db.delete(workspaces).where(eq(workspaces.id, workspaceId));
  await db.delete(users).where(eq(users.id, ownerId));
  await db.delete(users).where(eq(users.id, memberId));
}

describe.skipIf(!hasDb)("workspaces timezone (real DB)", () => {
  beforeAll(async () => {
    await cleanup();

    await db.insert(users).values([
      { id: ownerId, email: `ws-tz-${ownerId.slice(0, 8)}@example.com` },
      { id: memberId, email: `ws-tz-${memberId.slice(0, 8)}@example.com` },
    ]);
    await db.insert(workspaces).values({
      id: workspaceId,
      name: "TZ Workspace",
      ownerUserId: ownerId,
      timezone: "Asia/Kuala_Lumpur",
    });
  });

  afterAll(async () => {
    await cleanup();
  });

  // Stored IANA zone is returned verbatim so agent runs use business-local time.
  it("getWorkspaceTimeZone → returns the stored timezone for an existing workspace", async () => {
    const timezone = await getWorkspaceTimeZone(workspaceId);
    expect(timezone).toBe("Asia/Kuala_Lumpur");
  });

  // Missing workspace rows must not break agent runs; UTC is the safe default.
  it("getWorkspaceTimeZone → falls back to UTC for an unknown workspace", async () => {
    const timezone = await getWorkspaceTimeZone(missingWorkspaceId);
    expect(timezone).toBe("UTC");
  });

  // Owner can change the setting; persisted value is what the next agent run reads.
  it("updateWorkspaceSettingsAsOwner → persists the timezone for the owner", async () => {
    const result = await updateWorkspaceSettingsAsOwner(workspaceId, ownerId, {
      timezone: "Europe/London",
    });

    expect(result).toEqual({ ok: true });
    expect(await getWorkspaceTimeZone(workspaceId)).toBe("Europe/London");
  });

  // Non-owners cannot change workspace settings; the stored value stays untouched.
  it("updateWorkspaceSettingsAsOwner → rejects a non-owner and keeps the timezone", async () => {
    await updateWorkspaceSettingsAsOwner(workspaceId, ownerId, {
      timezone: "Asia/Kuala_Lumpur",
    });

    const result = await updateWorkspaceSettingsAsOwner(workspaceId, memberId, {
      timezone: "UTC",
    });

    expect(result).toEqual({ ok: false, message: "forbidden" });
    expect(await getWorkspaceTimeZone(workspaceId)).toBe("Asia/Kuala_Lumpur");
  });

  // Unknown workspace ids must be reported, not silently treated as success.
  it("updateWorkspaceSettingsAsOwner → rejects an unknown workspace", async () => {
    const result = await updateWorkspaceSettingsAsOwner(missingWorkspaceId, ownerId, {
      timezone: "UTC",
    });

    expect(result).toEqual({ ok: false, message: "workspace_not_found" });
  });

  // A patch without fields is a caller bug and must not issue an empty UPDATE.
  it("updateWorkspaceSettingsAsOwner → rejects an empty patch", async () => {
    const result = await updateWorkspaceSettingsAsOwner(workspaceId, ownerId, {});

    expect(result).toEqual({ ok: false, message: "empty_patch" });
  });
});
