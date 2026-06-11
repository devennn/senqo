import { eq, asc } from "drizzle-orm";
import { db } from "../db/index.js";
import { workspaceMembers } from "../db/schema/index.js";
import { findUserById } from "./auth-users.js";
import { addWorkspaceMember } from "./workspaces.js";
import type { TeamMemberRecord } from "../types/repositories.js";

const scope = "TeamRepository";

export async function listMembers(workspaceId: string): Promise<TeamMemberRecord[]> {
  try {
    const rows = await db
      .select({
        id: workspaceMembers.id,
        userId: workspaceMembers.userId,
        role: workspaceMembers.role,
        createdAt: workspaceMembers.createdAt,
        inviteEmail: workspaceMembers.inviteEmail,
      })
      .from(workspaceMembers)
      .where(eq(workspaceMembers.workspaceId, workspaceId))
      .orderBy(asc(workspaceMembers.createdAt));

    const members = await Promise.all(
      rows.map(async (row) => {
        const user = await findUserById(String(row.userId));
        const email = user?.email ?? String(row.inviteEmail ?? "").trim();
        return {
          id: String(row.id),
          email,
          role: String(row.role),
          joined_at: row.createdAt ? row.createdAt.toISOString() : null,
        };
      }),
    );

    console.info(`[${scope}/listMembers] Success: workspaceId=${workspaceId} count=${members.length}`);
    return members;
  } catch (error) {
    console.error(`[${scope}/listMembers] Unexpected error: ${String(error)}`);
    return [];
  }
}

export async function addMember(
  workspaceId: string,
  email: string,
): Promise<{ ok: boolean; message: string }> {
  const result = await addWorkspaceMember(workspaceId, email);
  return { ok: result.ok, message: result.message };
}
