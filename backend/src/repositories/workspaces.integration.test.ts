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
const { users, workspaces, workspaceMembers } = await import("../db/schema/index.js");
const {
  getWorkspaceTimeZone,
  updateWorkspaceSettingsAsOwner,
  getWorkspaceMemberRole,
  isWorkspaceOwnerOrAdmin,
  updateWorkspaceMemberRole,
} = await import("./workspaces.js");

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

const roleOwnerId = randomUUID();
const roleAdminId = randomUUID();
const roleMemberId = randomUUID();
const outsiderId = randomUUID();
const roleWorkspaceId = randomUUID();

async function cleanupRoleFixtures(): Promise<void> {
  await db.delete(workspaces).where(eq(workspaces.id, roleWorkspaceId));
  await db.delete(users).where(eq(users.id, roleOwnerId));
  await db.delete(users).where(eq(users.id, roleAdminId));
  await db.delete(users).where(eq(users.id, roleMemberId));
  await db.delete(users).where(eq(users.id, outsiderId));
}

describe.skipIf(!hasDb)("workspace member roles (real DB)", () => {
  beforeAll(async () => {
    await cleanupRoleFixtures();

    await db.insert(users).values([
      { id: roleOwnerId, email: `ws-role-owner-${roleOwnerId.slice(0, 8)}@example.com` },
      { id: roleAdminId, email: `ws-role-admin-${roleAdminId.slice(0, 8)}@example.com` },
      { id: roleMemberId, email: `ws-role-member-${roleMemberId.slice(0, 8)}@example.com` },
      { id: outsiderId, email: `ws-role-outsider-${outsiderId.slice(0, 8)}@example.com` },
    ]);
    await db.insert(workspaces).values({
      id: roleWorkspaceId,
      name: "Roles Workspace",
      ownerUserId: roleOwnerId,
    });
    await db.insert(workspaceMembers).values([
      { workspaceId: roleWorkspaceId, userId: roleAdminId, role: "admin" },
      { workspaceId: roleWorkspaceId, userId: roleMemberId, role: "member" },
    ]);
  });

  afterAll(async () => {
    await cleanupRoleFixtures();
  });

  // The owner is stored on workspaces, not in workspace_members.
  it("getWorkspaceMemberRole → returns owner for workspaces.owner_user_id", async () => {
    expect(await getWorkspaceMemberRole(roleWorkspaceId, roleOwnerId)).toBe("owner");
  });

  // Admin rows are surfaced distinctly so the team page can gate role management.
  it("getWorkspaceMemberRole → returns admin for a workspace_members admin row", async () => {
    expect(await getWorkspaceMemberRole(roleWorkspaceId, roleAdminId)).toBe("admin");
  });

  // Plain member rows default to the member role.
  it("getWorkspaceMemberRole → returns member for a workspace_members member row", async () => {
    expect(await getWorkspaceMemberRole(roleWorkspaceId, roleMemberId)).toBe("member");
  });

  // Users outside the workspace must not receive a role.
  it("getWorkspaceMemberRole → returns null for a non-teammate", async () => {
    expect(await getWorkspaceMemberRole(roleWorkspaceId, outsiderId)).toBeNull();
  });

  // Owner and admin can manage the team; members cannot.
  it("isWorkspaceOwnerOrAdmin → true for owner and admin, false for member", async () => {
    expect(await isWorkspaceOwnerOrAdmin(roleWorkspaceId, roleOwnerId)).toBe(true);
    expect(await isWorkspaceOwnerOrAdmin(roleWorkspaceId, roleAdminId)).toBe(true);
    expect(await isWorkspaceOwnerOrAdmin(roleWorkspaceId, roleMemberId)).toBe(false);
  });

  // Promotion persists the new role on the membership row.
  it("updateWorkspaceMemberRole → promotes a member to admin", async () => {
    const result = await updateWorkspaceMemberRole(roleWorkspaceId, roleMemberId, "admin");

    expect(result).toEqual({ ok: true });
    expect(await getWorkspaceMemberRole(roleWorkspaceId, roleMemberId)).toBe("admin");
  });

  // Demotion persists the role back to member.
  it("updateWorkspaceMemberRole → demotes an admin to member", async () => {
    const result = await updateWorkspaceMemberRole(roleWorkspaceId, roleMemberId, "member");

    expect(result).toEqual({ ok: true });
    expect(await getWorkspaceMemberRole(roleWorkspaceId, roleMemberId)).toBe("member");
  });

  // A user without a membership row cannot be assigned a role.
  it("updateWorkspaceMemberRole → rejects a non-teammate with target_not_member", async () => {
    const result = await updateWorkspaceMemberRole(roleWorkspaceId, outsiderId, "admin");

    expect(result).toEqual({ ok: false, message: "target_not_member" });
  });
});
