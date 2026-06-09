import { desc, eq, sql, and } from "drizzle-orm";
import { db } from "../db/index.js";
import {
  workspaces,
  workspaceMembers,
  profiles,
  users,
  agentAssets,
} from "../db/schema/index.js";
import { findUserById } from "./auth-users.js";
import type { WorkspaceSummary, TeamMemberRecord } from "../types/repositories.js";

type WorkspaceRow = typeof workspaces.$inferSelect;

const scope = "WorkspaceRepository";

export async function listWorkspacesForUser(userId: string): Promise<WorkspaceSummary[]> {
  try {
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

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      ownerUserId: r.ownerUserId,
      createdAt: r.createdAt.toISOString(),
      role: r.role as WorkspaceSummary["role"],
    }));
  } catch (error) {
    console.error(`[${scope}/listWorkspacesForUser] Unexpected error: ${String(error)}`);
    return [];
  }
}

export async function createWorkspaceForNewUser(userId: string): Promise<string | null> {
  try {
    const id = crypto.randomUUID();
    await db.insert(workspaces).values({
      id,
      name: "Default Workspace",
      ownerUserId: userId,
    });
    console.info(`[${scope}/createWorkspaceForNewUser] Success: userId=${userId}`);
    return id;
  } catch (error) {
    console.error(`[${scope}/createWorkspaceForNewUser] Unexpected error: ${String(error)}`);
    return null;
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
    const [ws] = await db
      .select({ id: workspaces.id })
      .from(workspaces)
      .where(eq(workspaces.id, workspaceId));

    if (!ws) return false;

    if (ws.id && ws.id) {
      const [owner] = await db
        .select({ id: workspaces.id })
        .from(workspaces)
        .where(
          sql`${workspaces.id} = ${workspaceId} and ${workspaces.ownerUserId} = ${userId}`,
        );
      if (owner) return true;
    }

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
    for (const row of rows) {
      const user = await findUserById(row.userId);
      members.push({
        id: row.id,
        email: user?.email ?? row.inviteEmail ?? null,
        role: row.role,
        joined_at: row.createdAt.toISOString(),
      });
    }

    console.info(`[${scope}/listWorkspaceMembers] Success: workspaceId=${workspaceId}`);
    return members;
  } catch (error) {
    console.error(`[${scope}/listWorkspaceMembers] Unexpected error: ${String(error)}`);
    return [];
  }
}

export async function addWorkspaceMember(
  workspaceId: string,
  inviteEmail: string,
): Promise<{ ok: boolean; message: string }> {
  try {
    const targetUser = await findUserByEmail(inviteEmail);
    if (!targetUser) {
      return { ok: false, message: "User with that email not found" };
    }

    const [existing] = await db
      .select({ id: workspaceMembers.id })
      .from(workspaceMembers)
      .where(
        sql`${workspaceMembers.workspaceId} = ${workspaceId} and ${workspaceMembers.userId} = ${targetUser.id}`,
      );

    if (existing) {
      return { ok: false, message: "User is already a member of this workspace" };
    }

    await db.insert(workspaceMembers).values({
      workspaceId,
      userId: targetUser.id,
      inviteEmail,
      role: "member",
    });

    console.info(`[${scope}/addWorkspaceMember] Success: workspaceId=${workspaceId}`);
    return { ok: true, message: "Member added" };
  } catch (error) {
    console.error(`[${scope}/addWorkspaceMember] Unexpected error: ${String(error)}`);
    return { ok: false, message: "Unexpected error" };
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

export async function findUserByEmail(email: string): Promise<{ id: string; email: string } | null> {
  try {
    const [user] = await db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(eq(users.email, email.toLowerCase().trim()));
    return user ?? null;
  } catch (error) {
    console.error(`[${scope}/findUserByEmail] Unexpected error: ${String(error)}`);
    return null;
  }
}