import { eq, and, inArray, asc } from "drizzle-orm";
import { db } from "../db/index.js";
import { conversationLabels, conversationLabelAssignments } from "../db/schema/index.js";
import type {
  ConversationLabelAssignmentSource,
  ConversationLabelBadge,
  ConversationLabelRecord,
} from "../types/repositories.js";

const scope = "ConversationLabelsRepository";

function normalizeSource(raw: string): ConversationLabelAssignmentSource {
  return raw === "ai" ? "ai" : "user";
}

function toLabelRecord(row: {
  id: string;
  workspaceId: string;
  name: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;
}): ConversationLabelRecord {
  return {
    id: row.id,
    workspace_id: row.workspaceId,
    name: row.name,
    description: row.description,
    created_at: row.createdAt as unknown as string,
    updated_at: row.updatedAt as unknown as string,
  };
}

export async function listConversationLabels(
  workspaceId: string,
): Promise<ConversationLabelRecord[]> {
  try {
    const rows = await db
      .select({
        id: conversationLabels.id,
        workspaceId: conversationLabels.workspaceId,
        name: conversationLabels.name,
        description: conversationLabels.description,
        createdAt: conversationLabels.createdAt,
        updatedAt: conversationLabels.updatedAt,
      })
      .from(conversationLabels)
      .where(eq(conversationLabels.workspaceId, workspaceId))
      .orderBy(asc(conversationLabels.name));

    console.info(`[${scope}/listConversationLabels] Success: userId=${workspaceId}`);
    return rows.map(toLabelRecord);
  } catch (error) {
    console.error(`[${scope}/listConversationLabels] Unexpected error: ${String(error)}`);
    return [];
  }
}

export async function createConversationLabel(input: {
  workspaceId: string;
  name: string;
  description: string;
}): Promise<{ ok: boolean; id?: string }> {
  try {
    const inserted = await db
      .insert(conversationLabels)
      .values({
        workspaceId: input.workspaceId,
        name: input.name.trim(),
        description: input.description.trim(),
      })
      .returning({ id: conversationLabels.id });

    const row = inserted[0];
    console.info(`[${scope}/createConversationLabel] Success: userId=${input.workspaceId}`);
    return { ok: true, id: row?.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[${scope}/createConversationLabel] Failed query: ${message}`);
    return { ok: false };
  }
}

export async function updateConversationLabel(input: {
  workspaceId: string;
  labelId: string;
  name: string;
  description: string;
}): Promise<{ ok: boolean }> {
  try {
    await db
      .update(conversationLabels)
      .set({
        name: input.name.trim(),
        description: input.description.trim(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(conversationLabels.id, input.labelId),
          eq(conversationLabels.workspaceId, input.workspaceId),
        ),
      );

    console.info(`[${scope}/updateConversationLabel] Success: userId=${input.workspaceId}`);
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[${scope}/updateConversationLabel] Failed query: ${message}`);
    return { ok: false };
  }
}

export async function deleteConversationLabel(
  workspaceId: string,
  labelId: string,
): Promise<{ ok: boolean }> {
  try {
    await db
      .delete(conversationLabels)
      .where(
        and(eq(conversationLabels.id, labelId), eq(conversationLabels.workspaceId, workspaceId)),
      );

    console.info(`[${scope}/deleteConversationLabel] Success: userId=${workspaceId}`);
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[${scope}/deleteConversationLabel] Failed query: ${message}`);
    return { ok: false };
  }
}

export async function listConversationIdsByLabel(
  workspaceId: string,
  labelId: string,
): Promise<Set<string>> {
  const ids = new Set<string>();
  try {
    const rows = await db
      .select({ conversationId: conversationLabelAssignments.conversationId })
      .from(conversationLabelAssignments)
      .where(
        and(
          eq(conversationLabelAssignments.workspaceId, workspaceId),
          eq(conversationLabelAssignments.labelId, labelId),
        ),
      );

    for (const row of rows) ids.add(row.conversationId);
    console.info(`[${scope}/listConversationIdsByLabel] Success: userId=${workspaceId}`);
    return ids;
  } catch (error) {
    console.error(
      `[${scope}/listConversationIdsByLabel] Unexpected error: ${String(error)}`,
    );
    return ids;
  }
}

export async function listLabelBadgesForConversations(
  workspaceId: string,
  conversationIds: string[],
): Promise<Map<string, ConversationLabelBadge[]>> {
  const map = new Map<string, ConversationLabelBadge[]>();
  if (conversationIds.length === 0) return map;

  try {
    const assignRows = await db
      .select({
        conversationId: conversationLabelAssignments.conversationId,
        labelId: conversationLabelAssignments.labelId,
        source: conversationLabelAssignments.source,
      })
      .from(conversationLabelAssignments)
      .where(
        and(
          eq(conversationLabelAssignments.workspaceId, workspaceId),
          inArray(conversationLabelAssignments.conversationId, conversationIds),
        ),
      );

    const labelIds = [...new Set(assignRows.map((r) => r.labelId))];
    const nameByLabelId = new Map<string, string>();
    if (labelIds.length > 0) {
      const labelRows = await db
        .select({
          id: conversationLabels.id,
          name: conversationLabels.name,
        })
        .from(conversationLabels)
        .where(
          and(
            eq(conversationLabels.workspaceId, workspaceId),
            inArray(conversationLabels.id, labelIds),
          ),
        );

      for (const row of labelRows) {
        nameByLabelId.set(row.id, row.name);
      }
    }

    for (const raw of assignRows) {
      const name = nameByLabelId.get(raw.labelId);
      if (!name) continue;
      const badge: ConversationLabelBadge = {
        id: raw.labelId,
        name,
        source: normalizeSource(raw.source),
      };
      const list = map.get(raw.conversationId) ?? [];
      list.push(badge);
      map.set(raw.conversationId, list);
    }

    for (const [, badges] of map) {
      badges.sort((a, b) => a.name.localeCompare(b.name));
    }

    console.info(`[${scope}/listLabelBadgesForConversations] Success: userId=${workspaceId}`);
    return map;
  } catch (error) {
    console.error(
      `[${scope}/listLabelBadgesForConversations] Unexpected error: ${String(error)}`,
    );
    return map;
  }
}

export async function validateLabelIdsForWorkspace(
  workspaceId: string,
  labelIds: string[],
): Promise<boolean> {
  if (labelIds.length === 0) return true;

  try {
    const rows = await db
      .select({ id: conversationLabels.id })
      .from(conversationLabels)
      .where(
        and(
          eq(conversationLabels.workspaceId, workspaceId),
          inArray(conversationLabels.id, labelIds),
        ),
      );

    const found = new Set(rows.map((r) => r.id));
    const ok = labelIds.every((id) => found.has(id));
    console.info(
      `[${scope}/validateLabelIdsForWorkspace] Success: userId=${workspaceId} ok=${ok}`,
    );
    return ok;
  } catch (error) {
    console.error(
      `[${scope}/validateLabelIdsForWorkspace] Unexpected error: ${String(error)}`,
    );
    return false;
  }
}

export async function replaceAssignmentsForConversation(input: {
  workspaceId: string;
  conversationId: string;
  labelIds: string[];
  source: ConversationLabelAssignmentSource;
}): Promise<{ ok: boolean }> {
  try {
    const uniqueIds = [...new Set(input.labelIds)];

    if (input.source === "user") {
      await db
        .delete(conversationLabelAssignments)
        .where(
          and(
            eq(conversationLabelAssignments.workspaceId, input.workspaceId),
            eq(conversationLabelAssignments.conversationId, input.conversationId),
            eq(conversationLabelAssignments.source, "user"),
          ),
        );

      if (uniqueIds.length === 0) {
        console.info(
          `[${scope}/replaceAssignmentsForConversation] Success: userId=${input.workspaceId} count=0`,
        );
        return { ok: true };
      }

      const rows = uniqueIds.map((labelId) => ({
        conversationId: input.conversationId,
        labelId,
        workspaceId: input.workspaceId,
        source: "user" as const,
      }));

      await db.insert(conversationLabelAssignments).values(rows).onConflictDoNothing();

      console.info(
        `[${scope}/replaceAssignmentsForConversation] Success: userId=${input.workspaceId} count=${uniqueIds.length}`,
      );
      return { ok: true };
    }

    await db
      .delete(conversationLabelAssignments)
      .where(
        and(
          eq(conversationLabelAssignments.workspaceId, input.workspaceId),
          eq(conversationLabelAssignments.conversationId, input.conversationId),
          eq(conversationLabelAssignments.source, "ai"),
        ),
      );

    const remaining = await db
      .select({ labelId: conversationLabelAssignments.labelId })
      .from(conversationLabelAssignments)
      .where(
        and(
          eq(conversationLabelAssignments.workspaceId, input.workspaceId),
          eq(conversationLabelAssignments.conversationId, input.conversationId),
        ),
      );

    const taken = new Set(remaining.map((r) => r.labelId));
    const toInsert = uniqueIds
      .filter((id) => !taken.has(id))
      .map((labelId) => ({
        conversationId: input.conversationId,
        labelId,
        workspaceId: input.workspaceId,
        source: "ai" as const,
      }));

    if (toInsert.length === 0) {
      console.info(
        `[${scope}/replaceAssignmentsForConversation] Success: userId=${input.workspaceId} ai=0`,
      );
      return { ok: true };
    }

    await db.insert(conversationLabelAssignments).values(toInsert);

    console.info(
      `[${scope}/replaceAssignmentsForConversation] Success: userId=${input.workspaceId} ai=${toInsert.length}`,
    );
    return { ok: true };
  } catch (error) {
    console.error(
      `[${scope}/replaceAssignmentsForConversation] Unexpected error: ${String(error)}`,
    );
    return { ok: false };
  }
}