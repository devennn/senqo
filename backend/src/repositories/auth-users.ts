import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { users } from "../db/schema/index.js";

const scope = "AuthUsersRepository";

export async function createUser(email: string, passwordHash: string, id?: string): Promise<typeof users.$inferSelect> {
  try {
    const userId = id ?? crypto.randomUUID();
    const [user] = await db.insert(users).values({
      id: userId,
      email: email.toLowerCase().trim(),
      passwordHash,
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
