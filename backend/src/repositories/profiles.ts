import { eq, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { workspaces, profiles } from "../db/schema/index.js";
import { findUserById } from "./auth-users.js";

const scope = "ProfilesRepository";

export async function ensureProfile(userId: string, email: string | undefined | null, fullName: string): Promise<void> {
  try {
    const existing = await db.select({ id: profiles.id }).from(profiles).where(eq(profiles.id, userId));
    if (existing.length > 0) {
      console.info(`[${scope}/ensureProfile] Success (existing): userId=${userId}`);
      return;
    }
  } catch (error) {
    console.error(`[${scope}/ensureProfile] Unexpected error: ${String(error)}`);
  }

  const workspaceId = crypto.randomUUID();
  const nameParts = fullName ? fullName.trim().split(/\s+/) : [];
  const firstName = nameParts[0] ?? null;
  const lastName = nameParts.slice(1).join(" ") || null;

  try {
    await db.insert(workspaces).values({
      id: workspaceId,
      name: "Default Workspace",
      ownerUserId: userId,
    });

    await db.insert(profiles).values({
      id: userId,
      workspaceId,
      firstName,
      lastName,
    });

    console.info(`[${scope}/ensureProfile] Success (created): userId=${userId}`);
  } catch (error) {
    console.error(`[${scope}/ensureProfile] Unexpected error: ${String(error)}`);
  }
}

export async function updateProfile(
  userId: string,
  fields: { first_name?: string; last_name?: string },
): Promise<void> {
  try {
    const updateData: Record<string, string> = {};
    if (fields.first_name !== undefined) updateData.firstName = fields.first_name;
    if (fields.last_name !== undefined) updateData.lastName = fields.last_name;

    if (Object.keys(updateData).length === 0) return;

    await db.update(profiles).set(updateData).where(eq(profiles.id, userId));
    console.info(`[${scope}/updateProfile] Success: userId=${userId}`);
  } catch (error) {
    console.error(`[${scope}/updateProfile] Unexpected error: ${String(error)}`);
  }
}

export async function getProfileForSettings(
  userId: string,
): Promise<{ workspace_id: string; first_name: string | null; last_name: string | null } | null> {
  try {
    const [row] = await db
      .select({
        workspaceId: profiles.workspaceId,
        firstName: profiles.firstName,
        lastName: profiles.lastName,
      })
      .from(profiles)
      .where(eq(profiles.id, userId));

    if (!row) {
      console.info(`[${scope}/getProfileForSettings] Success: userId=${userId} found=false`);
      return null;
    }

    console.info(`[${scope}/getProfileForSettings] Success: userId=${userId}`);
    return {
      workspace_id: row.workspaceId ?? userId,
      first_name: row.firstName,
      last_name: row.lastName,
    };
  } catch (error) {
    console.error(`[${scope}/getProfileForSettings] Unexpected error: ${String(error)}`);
    return null;
  }
}

export async function getWorkspaceOwnerEmail(workspaceId: string): Promise<string | null> {
  try {
    const [ws] = await db
      .select({ ownerUserId: workspaces.ownerUserId })
      .from(workspaces)
      .where(eq(workspaces.id, workspaceId));

    if (!ws) return null;

    const user = await findUserById(ws.ownerUserId);
    return user?.email ?? null;
  } catch (error) {
    console.error(`[${scope}/getWorkspaceOwnerEmail] Unexpected error: ${String(error)}`);
    return null;
  }
}