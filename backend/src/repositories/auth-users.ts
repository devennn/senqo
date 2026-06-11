import { eq, sql, count, and, isNull } from "drizzle-orm";
import { db } from "../db/index.js";
import { users, workspaces } from "../db/schema/index.js";

const scope = "AuthUsersRepository";

export async function createUser(
  email: string,
  passwordHash: string,
  id?: string,
  options?: { isInstanceAdmin?: boolean },
): Promise<typeof users.$inferSelect> {
  try {
    const userId = id ?? crypto.randomUUID();
    const [user] = await db.insert(users).values({
      id: userId,
      email: email.toLowerCase().trim(),
      passwordHash,
      isInstanceAdmin: options?.isInstanceAdmin ?? false,
    }).returning();
    console.info(`[${scope}/createUser] Success: email=${email}`);
    return user;
  } catch (error) {
    console.error(`[${scope}/createUser] Unexpected error: ${String(error)}`);
    throw error;
  }
}

export async function findUserByEmail(email: string): Promise<typeof users.$inferSelect | null> {
  try {
    const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase().trim()));
    console.info(`[${scope}/findUserByEmail] Success: email=${email}`);
    return user ?? null;
  } catch (error) {
    console.error(`[${scope}/findUserByEmail] Unexpected error: ${String(error)}`);
    return null;
  }
}

export async function findUserById(id: string): Promise<typeof users.$inferSelect | null> {
  try {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    console.info(`[${scope}/findUserById] Success: userId=${id}`);
    return user ?? null;
  } catch (error) {
    console.error(`[${scope}/findUserById] Unexpected error: ${String(error)}`);
    return null;
  }
}

export async function updateUserPassword(userId: string, newPasswordHash: string): Promise<void> {
  try {
    await db.update(users).set({ passwordHash: newPasswordHash }).where(eq(users.id, userId));
    console.info(`[${scope}/updateUserPassword] Success: userId=${userId}`);
  } catch (error) {
    console.error(`[${scope}/updateUserPassword] Unexpected error: ${String(error)}`);
  }
}

export async function countUsers(): Promise<number> {
  try {
    const [row] = await db.select({ value: count() }).from(users);
    const total = Number(row?.value ?? 0);
    console.info(`[${scope}/countUsers] Success: count=${total}`);
    return total;
  } catch (error) {
    console.error(`[${scope}/countUsers] Unexpected error: ${String(error)}`);
    return 0;
  }
}

export function isUserDisabled(user: typeof users.$inferSelect): boolean {
  return user.disabledAt != null;
}

export async function isInstanceAdmin(userId: string): Promise<boolean> {
  try {
    const [user] = await db
      .select({ isInstanceAdmin: users.isInstanceAdmin })
      .from(users)
      .where(eq(users.id, userId));
    return user?.isInstanceAdmin === true;
  } catch (error) {
    console.error(`[${scope}/isInstanceAdmin] Unexpected error: ${String(error)}`);
    return false;
  }
}

export async function countInstanceAdmins(): Promise<number> {
  try {
    const [row] = await db
      .select({ value: count() })
      .from(users)
      .where(eq(users.isInstanceAdmin, true));
    return Number(row?.value ?? 0);
  } catch (error) {
    console.error(`[${scope}/countInstanceAdmins] Unexpected error: ${String(error)}`);
    return 0;
  }
}

export type InstanceUserRecord = {
  id: string;
  email: string;
  created_at: string;
  is_instance_admin: boolean;
  disabled_at: string | null;
  owned_workspace_count: number;
};

export async function listAllUsers(): Promise<InstanceUserRecord[]> {
  try {
    const rows = await db
      .select({
        id: users.id,
        email: users.email,
        createdAt: users.createdAt,
        isInstanceAdmin: users.isInstanceAdmin,
        disabledAt: users.disabledAt,
        ownedCount: sql<number>`(
          select count(*)::int from ${workspaces}
          where ${workspaces.ownerUserId} = ${users.id}
        )`,
      })
      .from(users)
      .orderBy(users.createdAt);

    console.info(`[${scope}/listAllUsers] Success: count=${rows.length}`);
    return rows.map((r) => ({
      id: r.id,
      email: r.email,
      created_at: r.createdAt.toISOString(),
      is_instance_admin: r.isInstanceAdmin,
      disabled_at: r.disabledAt?.toISOString() ?? null,
      owned_workspace_count: Number(r.ownedCount ?? 0),
    }));
  } catch (error) {
    console.error(`[${scope}/listAllUsers] Unexpected error: ${String(error)}`);
    return [];
  }
}

export async function setUserDisabled(
  userId: string,
  disabled: boolean,
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    await db
      .update(users)
      .set({ disabledAt: disabled ? new Date() : null })
      .where(eq(users.id, userId));
    console.info(`[${scope}/setUserDisabled] Success: userId=${userId} disabled=${disabled}`);
    return { ok: true };
  } catch (error) {
    console.error(`[${scope}/setUserDisabled] Unexpected error: ${String(error)}`);
    return { ok: false, message: "unexpected_error" };
  }
}

export async function setInstanceAdmin(
  userId: string,
  value: boolean,
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    await db.update(users).set({ isInstanceAdmin: value }).where(eq(users.id, userId));
    console.info(`[${scope}/setInstanceAdmin] Success: userId=${userId} value=${value}`);
    return { ok: true };
  } catch (error) {
    console.error(`[${scope}/setInstanceAdmin] Unexpected error: ${String(error)}`);
    return { ok: false, message: "unexpected_error" };
  }
}

export async function deleteUser(
  userId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const [owned] = await db
      .select({ value: count() })
      .from(workspaces)
      .where(eq(workspaces.ownerUserId, userId));

    if (Number(owned?.value ?? 0) > 0) {
      console.info(`[${scope}/deleteUser] Failed query: user owns workspaces`);
      return { ok: false, message: "user_owns_workspaces" };
    }

    await db.delete(users).where(eq(users.id, userId));
    console.info(`[${scope}/deleteUser] Success: userId=${userId}`);
    return { ok: true };
  } catch (error) {
    console.error(`[${scope}/deleteUser] Unexpected error: ${String(error)}`);
    return { ok: false, message: "unexpected_error" };
  }
}

export async function userOwnsWorkspaces(userId: string): Promise<boolean> {
  try {
    const [row] = await db
      .select({ value: count() })
      .from(workspaces)
      .where(eq(workspaces.ownerUserId, userId));
    return Number(row?.value ?? 0) > 0;
  } catch (error) {
    console.error(`[${scope}/userOwnsWorkspaces] Unexpected error: ${String(error)}`);
    return false;
  }
}
