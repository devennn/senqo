import { desc, eq, sql, and, count } from "drizzle-orm";
import { db } from "../db/index.js";
import {
  workspaces,
  workspaceMembers,
  users,
} from "../db/schema/index.js";
import { isInstanceAdmin, findUserById, findUserByEmail } from "./auth-users.js";
import { listHandoffPhonesForUsers } from "./handoff-phones.js";
import { listConnections } from "./whatsapp.js";
import type { WorkspaceSummary, TeamMemberRecord } from "../types/repositories.js";

type WorkspaceRow = typeof workspaces.$inferSelect;

const scope = "WorkspaceRepository";

export type AdminWorkspaceRecord = {
  id: string;
  name: string;
  owner_user_id: string;
  owner_email: string | null;
  created_at: string;
  member_count: number;
};

export async function listAllWorkspaces(): Promise<AdminWorkspaceRecord[]> {
  try {
    const rows = await db
      .select({
        id: workspaces.id,
        name: workspaces.name,
        ownerUserId: workspaces.ownerUserId,
        createdAt: workspaces.createdAt,
        ownerEmail: users.email,
        memberCount: sql<number>`(
          select count(*)::int from ${workspaceMembers}
          where ${workspaceMembers.workspaceId} = ${workspaces.id}
        )`,
      })
      .from(workspaces)
      .innerJoin(users, eq(workspaces.ownerUserId, users.id))
      .orderBy(desc(workspaces.createdAt));

    console.info(`[${scope}/listAllWorkspaces] Success: count=${rows.length}`);
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      owner_user_id: r.ownerUserId,
      owner_email: r.ownerEmail,
      created_at: r.createdAt.toISOString(),
      member_count: Number(r.memberCount ?? 0),
    }));
  } catch (error) {
    console.error(`[${scope}/listAllWorkspaces] Unexpected error: ${String(error)}`);
    return [];
  }
}

export async function listWorkspacesForUser(userId: string): Promise<WorkspaceSummary[]> {
  try {
    if (await isInstanceAdmin(userId)) {
      const all = await listAllWorkspaces();
      return all.map((w) => ({
        id: w.id,
        name: w.name,
        ownerUserId: w.owner_user_id,
        createdAt: w.created_at,
        role: "superadmin" as const,
      }));
    }

    const rows = await db
      .select({
        id: workspaces.id,
        name: workspaces.name,
        ownerUserId: workspaces.ownerUserId,
        createdAt: workspaces.createdAt,
        role: sql<string>`case when ${workspaces.ownerUserId} = ${userId} then 'owner' else 'member' end`,
      })
      .from(workspaces)
      .leftJoin(workspaceMembers, eq(workspaces.id, workspaceMembers.workspaceId))
      .where(
        sql`${workspaces.ownerUserId} = ${userId} or ${workspaceMembers.userId} = ${userId}`,
      )
      .orderBy(desc(workspaces.createdAt));

    const seen = new Set<string>();
    const result: WorkspaceSummary[] = [];
    for (const r of rows) {
      if (seen.has(r.id)) continue;
      seen.add(r.id);
      result.push({
        id: r.id,
        name: r.name,
        ownerUserId: r.ownerUserId,
        createdAt: r.createdAt.toISOString(),
        role: r.role as WorkspaceSummary["role"],
      });
    }

    console.info(`[${scope}/listWorkspacesForUser] Success: userId=${userId} count=${result.length}`);
    return result;
  } catch (error) {
    console.error(`[${scope}/listWorkspacesForUser] Unexpected error: ${String(error)}`);
    return [];
  }
}

export async function createWorkspaceForUser(
  userId: string,
  name: string,
): Promise<{ ok: true; workspaceId: string } | { ok: false; message: string }> {
  const trimmed = name.trim();
  if (!trimmed) {
    return { ok: false, message: "name_required" };
  }

  try {
    const workspaceId = crypto.randomUUID();
    await db.insert(workspaces).values({
      id: workspaceId,
      name: trimmed,
      ownerUserId: userId,
    });

    const { ensureDefaultCustomTools } = await import("../lib/seed-default-custom-tools.js");
    await ensureDefaultCustomTools(workspaceId);

    console.info(`[${scope}/createWorkspaceForUser] Success: userId=${userId} workspaceId=${workspaceId}`);
    return { ok: true, workspaceId };
  } catch (error) {
    console.error(`[${scope}/createWorkspaceForUser] Unexpected error: ${String(error)}`);
    return { ok: false, message: "unexpected_error" };
  }
}

export async function deleteWorkspace(
  workspaceId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const [row] = await db.select({ id: workspaces.id }).from(workspaces).where(eq(workspaces.id, workspaceId));
    if (!row) {
      console.info(`[${scope}/deleteWorkspace] Failed query: not found`);
      return { ok: false, message: "workspace_not_found" };
    }

    await db.delete(workspaces).where(eq(workspaces.id, workspaceId));
    console.info(`[${scope}/deleteWorkspace] Success: workspaceId=${workspaceId}`);
    return { ok: true };
  } catch (error) {
    console.error(`[${scope}/deleteWorkspace] Unexpected error: ${String(error)}`);
    return { ok: false, message: "unexpected_error" };
  }
}

export async function updateWorkspaceNameAsOwner(
  workspaceId: string,
  userId: string,
  name: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const [ws] = await db
      .select({ ownerUserId: workspaces.ownerUserId })
      .from(workspaces)
      .where(eq(workspaces.id, workspaceId));

    if (!ws) return { ok: false, message: "workspace_not_found" };
    if (ws.ownerUserId !== userId) return { ok: false, message: "forbidden" };

    await db
      .update(workspaces)
      .set({ name: name.trim() })
      .where(eq(workspaces.id, workspaceId));

    console.info(`[${scope}/updateWorkspaceNameAsOwner] Success: workspaceId=${workspaceId}`);
    return { ok: true };
  } catch (error) {
    console.error(`[${scope}/updateWorkspaceNameAsOwner] Unexpected error: ${String(error)}`);
    return { ok: false, message: "unexpected_error" };
  }
}

export async function validateWorkspaceMembership(
  workspaceId: string,
  userId: string,
): Promise<boolean> {
  try {
    if (await isInstanceAdmin(userId)) {
      const [ws] = await db.select({ id: workspaces.id }).from(workspaces).where(eq(workspaces.id, workspaceId));
      return !!ws;
    }

    const [ws] = await db
      .select({ id: workspaces.id })
      .from(workspaces)
      .where(eq(workspaces.id, workspaceId));

    if (!ws) return false;

    const [owner] = await db
      .select({ id: workspaces.id })
      .from(workspaces)
      .where(
        sql`${workspaces.id} = ${workspaceId} and ${workspaces.ownerUserId} = ${userId}`,
      );
    if (owner) return true;

    const [member] = await db
      .select({ id: workspaceMembers.id })
      .from(workspaceMembers)
      .where(
        sql`${workspaceMembers.workspaceId} = ${workspaceId} and ${workspaceMembers.userId} = ${userId}`,
      );
    return !!member;
  } catch (error) {
    console.error(`[${scope}/validateWorkspaceMembership] Unexpected error: ${String(error)}`);
    return false;
  }
}

export async function listWorkspaceMembers(
  workspaceId: string,
): Promise<TeamMemberRecord[]> {
  try {
    const [workspace] = await db
      .select({
        ownerUserId: workspaces.ownerUserId,
        createdAt: workspaces.createdAt,
      })
      .from(workspaces)
      .where(eq(workspaces.id, workspaceId))
      .limit(1);

    if (!workspace) {
      console.info(
        `[${scope}/listWorkspaceMembers] Failed query: workspace not found workspaceId=${workspaceId}`,
      );
      return [];
    }

    const rows = await db
      .select({
        id: workspaceMembers.id,
        role: workspaceMembers.role,
        inviteEmail: workspaceMembers.inviteEmail,
        createdAt: workspaceMembers.createdAt,
        userId: workspaceMembers.userId,
      })
      .from(workspaceMembers)
      .where(eq(workspaceMembers.workspaceId, workspaceId))
      .orderBy(desc(workspaceMembers.createdAt));

    const members: TeamMemberRecord[] = [];
    const ownerUser = await findUserById(workspace.ownerUserId);
    members.push({
      id: workspace.ownerUserId,
      userId: workspace.ownerUserId,
      email: ownerUser?.email ?? null,
      role: "owner",
      joined_at: workspace.createdAt.toISOString(),
      handoffPhones: [],
    });

    for (const row of rows) {
      if (row.userId === workspace.ownerUserId) continue;
      const user = await findUserById(row.userId);
      members.push({
        id: row.id,
        userId: row.userId,
        email: user?.email ?? row.inviteEmail ?? null,
        role: row.role,
        joined_at: row.createdAt.toISOString(),
        handoffPhones: [],
      });
    }

    const [phones, connections] = await Promise.all([
      listHandoffPhonesForUsers(
        workspaceId,
        members.map((m) => m.userId),
      ),
      listConnections(workspaceId),
    ]);
    const connectionNameById = new Map(
      connections.map((c) => [
        c.id,
        c.display_name?.trim() || c.phone_number?.trim() || c.id,
      ]),
    );
    const phonesByUser = new Map<string, typeof phones>();
    for (const phone of phones) {
      const list = phonesByUser.get(phone.userId) ?? [];
      list.push(phone);
      phonesByUser.set(phone.userId, list);
    }
    for (const member of members) {
      const userPhones = phonesByUser.get(member.userId) ?? [];
      member.handoffPhones = userPhones.map((p) => ({
        connectionId: p.whatsappConnectionId,
        connectionName: connectionNameById.get(p.whatsappConnectionId) ?? p.whatsappConnectionId,
        phone: p.phone,
        status: p.status,
      }));
    }

    console.info(`[${scope}/listWorkspaceMembers] Success: workspaceId=${workspaceId}`);
    return members;
  } catch (error) {
    console.error(`[${scope}/listWorkspaceMembers] Unexpected error: ${String(error)}`);
    return [];
  }
}

/** True when userId is the workspace owner or a workspace_members row (not instance-admin bypass). */
export async function isWorkspaceTeammate(
  workspaceId: string,
  userId: string,
): Promise<boolean> {
  try {
    const [owner] = await db
      .select({ id: workspaces.id })
      .from(workspaces)
      .where(
        and(eq(workspaces.id, workspaceId), eq(workspaces.ownerUserId, userId)),
      )
      .limit(1);
    if (owner) {
      console.info(
        `[${scope}/isWorkspaceTeammate] Success: owner workspaceId=${workspaceId} userId=${userId}`,
      );
      return true;
    }
    const [member] = await db
      .select({ id: workspaceMembers.id })
      .from(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.workspaceId, workspaceId),
          eq(workspaceMembers.userId, userId),
        ),
      )
      .limit(1);
    console.info(
      `[${scope}/isWorkspaceTeammate] Success: workspaceId=${workspaceId} userId=${userId} member=${!!member}`,
    );
    return !!member;
  } catch (error) {
    console.error(`[${scope}/isWorkspaceTeammate] Unexpected error: ${String(error)}`);
    return false;
  }
}

export async function addWorkspaceMember(
  workspaceId: string,
  inviteEmail: string,
): Promise<{ ok: boolean; message: string }> {
  try {
    const targetUser = await findUserByEmail(inviteEmail);
    if (!targetUser) {
      return { ok: false, message: "user_not_found" };
    }

    if (targetUser.disabledAt) {
      return { ok: false, message: "user_disabled" };
    }

    const [existing] = await db
      .select({ id: workspaceMembers.id })
      .from(workspaceMembers)
      .where(
        sql`${workspaceMembers.workspaceId} = ${workspaceId} and ${workspaceMembers.userId} = ${targetUser.id}`,
      );

    if (existing) {
      return { ok: false, message: "already_member" };
    }

    const [owner] = await db
      .select({ ownerUserId: workspaces.ownerUserId })
      .from(workspaces)
      .where(eq(workspaces.id, workspaceId));

    if (owner?.ownerUserId === targetUser.id) {
      return { ok: false, message: "already_owner" };
    }

    await db.insert(workspaceMembers).values({
      workspaceId,
      userId: targetUser.id,
      inviteEmail: inviteEmail.toLowerCase().trim(),
      role: "member",
    });

    console.info(`[${scope}/addWorkspaceMember] Success: workspaceId=${workspaceId}`);
    return { ok: true, message: "member_added" };
  } catch (error) {
    console.error(`[${scope}/addWorkspaceMember] Unexpected error: ${String(error)}`);
    return { ok: false, message: "unexpected_error" };
  }
}

export async function getWorkspaceRow(workspaceId: string): Promise<WorkspaceRow | null> {
  try {
    const [row] = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, workspaceId));
    return row ?? null;
  } catch (error) {
    console.error(`[${scope}/getWorkspaceRow] Unexpected error: ${String(error)}`);
    return null;
  }
}

export async function listUserWorkspaces(userId: string): Promise<WorkspaceSummary[]> {
  return listWorkspacesForUser(userId);
}

export async function isWorkspaceOwner(workspaceId: string, userId: string): Promise<boolean> {
  try {
    const [ws] = await db
      .select({ ownerUserId: workspaces.ownerUserId })
      .from(workspaces)
      .where(
        and(
          eq(workspaces.id, workspaceId),
          eq(workspaces.ownerUserId, userId),
        ),
      );
    return !!ws;
  } catch (error) {
    console.error(`[${scope}/isWorkspaceOwner] Unexpected error: ${String(error)}`);
    return false;
  }
}

export async function countWorkspacesOwnedByUser(userId: string): Promise<number> {
  try {
    const [row] = await db
      .select({ value: count() })
      .from(workspaces)
      .where(eq(workspaces.ownerUserId, userId));
    return Number(row?.value ?? 0);
  } catch (error) {
    console.error(`[${scope}/countWorkspacesOwnedByUser] Unexpected error: ${String(error)}`);
    return 0;
  }
}
