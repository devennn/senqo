import { and, eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { workspaceErrorAlertSubscribers } from "../db/schema/index.js";

const scope = "ErrorAlertSubscribersRepository";

/** User ids opted in to receive WhatsApp alerts when an AI run fails. */
export async function listErrorAlertSubscriberUserIds(
  workspaceId: string,
): Promise<string[]> {
  try {
    const rows = await db
      .select({ userId: workspaceErrorAlertSubscribers.userId })
      .from(workspaceErrorAlertSubscribers)
      .where(eq(workspaceErrorAlertSubscribers.workspaceId, workspaceId));
    console.info(
      `[${scope}/listErrorAlertSubscriberUserIds] Success: userId=${workspaceId} count=${rows.length}`,
    );
    return rows.map((row) => row.userId);
  } catch (error) {
    console.error(
      `[${scope}/listErrorAlertSubscriberUserIds] Unexpected error: ${String(error)}`,
    );
    return [];
  }
}

export async function setErrorAlertSubscriber(
  workspaceId: string,
  userId: string,
  enabled: boolean,
): Promise<{ ok: boolean }> {
  try {
    if (enabled) {
      await db
        .insert(workspaceErrorAlertSubscribers)
        .values({ workspaceId, userId })
        .onConflictDoNothing({
          target: [
            workspaceErrorAlertSubscribers.workspaceId,
            workspaceErrorAlertSubscribers.userId,
          ],
        });
    } else {
      await db
        .delete(workspaceErrorAlertSubscribers)
        .where(
          and(
            eq(workspaceErrorAlertSubscribers.workspaceId, workspaceId),
            eq(workspaceErrorAlertSubscribers.userId, userId),
          ),
        );
    }
    console.info(
      `[${scope}/setErrorAlertSubscriber] Success: userId=${workspaceId} targetUserId=${userId} enabled=${enabled}`,
    );
    return { ok: true };
  } catch (error) {
    console.error(
      `[${scope}/setErrorAlertSubscriber] Unexpected error: ${String(error)}`,
    );
    return { ok: false };
  }
}
