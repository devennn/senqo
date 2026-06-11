import { eq, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { workspaces, profiles } from "../db/schema/index.js";
import { findUserById } from "./auth-users.js";

const scope = "ProfilesRepository";

function parseNameParts(fullName: string): { firstName: string | null; lastName: string | null } {
  const nameParts = fullName ? fullName.trim().split(/\s+/) : [];
  const firstName = nameParts[0] ?? null;
  const lastName = nameParts.slice(1).join(" ") || null;
  return { firstName, lastName };
}

export async function provisionPlatformUser(userId: string, fullName: string): Promise<void> {
  const { firstName, lastName } = parseNameParts(fullName);

  try {
    const existing = await db.select({ id: profiles.id }).from(profiles).where(eq(profiles.id, userId));
    if (existing.length > 0) {
      console.info(`[${scope}/provisionPlatformUser] Success (existing): userId=${userId}`);
      return;
    }

    await db.insert(profiles).values({
      id: userId,
      workspaceId: null,
      firstName,
      lastName,
    });

    console.info(`[${scope}/provisionPlatformUser] Success: userId=${userId}`);
  } catch (error) {
    console.error(`[${scope}/provisionPlatformUser] Unexpected error: ${String(error)}`);
  }
}

export async function provisionOwnerWorkspace(
  userId: string,
  _email: string | undefined | null,
  fullName: string,
  workspaceName = "Default Workspace",
): Promise<string | null> {
  const { firstName, lastName } = parseNameParts(fullName);
  const workspaceId = crypto.randomUUID();

  try {
    const existing = await db.select({ id: profiles.id }).from(profiles).where(eq(profiles.id, userId));
    if (existing.length > 0) {
      console.info(`[${scope}/provisionOwnerWorkspace] Success (existing profile): userId=${userId}`);
      const [profile] = await db
        .select({ workspaceId: profiles.workspaceId })
        .from(profiles)
        .where(eq(profiles.id, userId));
      return profile?.workspaceId ?? null;
    }

    await db.insert(workspaces).values({
      id: workspaceId,
      name: workspaceName.trim() || "Default Workspace",
      ownerUserId: userId,
    });

    await db.insert(profiles).values({
      id: userId,
      workspaceId,
      firstName,
      lastName,
    });

    const { ensureDefaultCustomTools } = await import("../lib/seed-default-custom-tools.js");
    await ensureDefaultCustomTools(workspaceId);

    console.info(`[${scope}/provisionOwnerWorkspace] Success: userId=${userId} workspaceId=${workspaceId}`);
    return workspaceId;
  } catch (error) {
    console.error(`[${scope}/provisionOwnerWorkspace] Unexpected error: ${String(error)}`);
    return null;
  }
}

/** Legacy: only creates profile+workspace if user has neither (open-registration signup). */
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

  await provisionOwnerWorkspace(userId, email, fullName);
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
): Promise<{ workspace_id: string | null; first_name: string | null; last_name: string | null } | null> {
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
      workspace_id: row.workspaceId,
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

export async function userHasProfile(userId: string): Promise<boolean> {
  try {
    const [row] = await db.select({ id: profiles.id }).from(profiles).where(eq(profiles.id, userId));
    return !!row;
  } catch (error) {
    console.error(`[${scope}/userHasProfile] Unexpected error: ${String(error)}`);
    return false;
  }
}
