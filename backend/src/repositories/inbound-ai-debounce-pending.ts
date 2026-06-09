import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { inboundAiDebouncePending } from "../db/schema/index.js";

const scope = "InboundAiDebouncePending";

export async function getInboundAiDebouncePendingJobId(
  conversationId: string,
): Promise<string | null> {
  try {
    const rows = await db
      .select({ jobId: inboundAiDebouncePending.jobId })
      .from(inboundAiDebouncePending)
      .where(eq(inboundAiDebouncePending.conversationId, conversationId))
      .limit(1);

    const raw = rows[0]?.jobId;
    console.info(
      `[${scope}/getInboundAiDebouncePendingJobId] Success: conversationId=${conversationId}`,
    );
    return raw && raw.length > 0 ? raw : null;
  } catch (error) {
    console.error(`[${scope}/getInboundAiDebouncePendingJobId] Unexpected error: ${String(error)}`);
    return null;
  }
}

export async function upsertInboundAiDebouncePending(input: {
  conversationId: string;
  workspaceId: string;
  pendingJobId: string;
}): Promise<boolean> {
  try {
    await db
      .delete(inboundAiDebouncePending)
      .where(eq(inboundAiDebouncePending.conversationId, input.conversationId));

    await db.insert(inboundAiDebouncePending).values({
      conversationId: input.conversationId,
      workspaceId: input.workspaceId,
      jobId: input.pendingJobId,
    });

    console.info(
      `[${scope}/upsertInboundAiDebouncePending] Success: conversationId=${input.conversationId}`,
    );
    return true;
  } catch (error) {
    console.error(`[${scope}/upsertInboundAiDebouncePending] Unexpected error: ${String(error)}`);
    return false;
  }
}

export async function clearInboundAiDebouncePending(conversationId: string): Promise<boolean> {
  try {
    await db
      .delete(inboundAiDebouncePending)
      .where(eq(inboundAiDebouncePending.conversationId, conversationId));

    console.info(`[${scope}/clearInboundAiDebouncePending] Success: conversationId=${conversationId}`);
    return true;
  } catch (error) {
    console.error(`[${scope}/clearInboundAiDebouncePending] Unexpected error: ${String(error)}`);
    return false;
  }
}
