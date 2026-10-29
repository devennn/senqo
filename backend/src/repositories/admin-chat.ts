import { asc, eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { adminChatMessages } from "../db/schema/index.js";

const scope = "AdminChatRepository";

export type AdminChatMessageRecord = {
  id: string;
  role: string;
  content: string;
  created_at: string;
};

export async function createAdminChatMessage(
  userId: string,
  role: "user" | "assistant",
  content: string,
): Promise<AdminChatMessageRecord | null> {
  try {
    const [row] = await db
      .insert(adminChatMessages)
      .values({ userId, role, content })
      .returning({
        id: adminChatMessages.id,
        role: adminChatMessages.role,
        content: adminChatMessages.content,
        createdAt: adminChatMessages.createdAt,
      });

    console.info(`[${scope}/createAdminChatMessage] Success: userId=${userId} role=${role}`);
    return {
      id: row.id,
      role: row.role,
      content: row.content,
      created_at: row.createdAt.toISOString(),
    };
  } catch (error) {
    console.error(`[${scope}/createAdminChatMessage] Unexpected error: ${String(error)}`);
    return null;
  }
}

export async function listAdminChatMessages(
  userId: string,
  limit: number,
): Promise<AdminChatMessageRecord[]> {
  try {
    const rows = await db
      .select({
        id: adminChatMessages.id,
        role: adminChatMessages.role,
        content: adminChatMessages.content,
        createdAt: adminChatMessages.createdAt,
      })
      .from(adminChatMessages)
      .where(eq(adminChatMessages.userId, userId))
      .orderBy(asc(adminChatMessages.createdAt));

    console.info(`[${scope}/listAdminChatMessages] Success: userId=${userId} count=${rows.length}`);
    return rows.slice(-limit).map((row) => ({
      id: row.id,
      role: row.role,
      content: row.content,
      created_at: row.createdAt.toISOString(),
    }));
  } catch (error) {
    console.error(`[${scope}/listAdminChatMessages] Unexpected error: ${String(error)}`);
    return [];
  }
}

export async function deleteAdminChatMessages(
  userId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    await db.delete(adminChatMessages).where(eq(adminChatMessages.userId, userId));
    console.info(`[${scope}/deleteAdminChatMessages] Success: userId=${userId}`);
    return { ok: true };
  } catch (error) {
    console.error(`[${scope}/deleteAdminChatMessages] Unexpected error: ${String(error)}`);
    return { ok: false, message: "unexpected_error" };
  }
}
