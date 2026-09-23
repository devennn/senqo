import { and, eq, gte, inArray, isNotNull, isNull, lte, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import {
  agentConfigs,
  conversationReports,
  conversations,
  messages,
  whatsappConnections,
  workspaceHandoffTopicEntries,
  workspaceHandoffTopicGroups,
} from "../db/schema/index.js";
import { THREAD_EVENT_HANDOFF_TO_HUMAN } from "../lib/conversation-thread-events.js";
import type {
  AgentPerformanceReport,
  AgentPerformanceRow,
  AgentPerformanceSummary,
  HandoffTopicPerformanceRow,
} from "../types/reports.js";
import { REPORTS_NO_TOPIC_LABEL, REPORTS_OTHER_TOPIC_ID } from "../types/reports.js";

const scope = "ReportsRepository";

export function reportDateBounds(
  fromYmd: string,
  toYmd: string,
): { fromDate: Date; toDate: Date } {
  return {
    fromDate: new Date(`${fromYmd}T00:00:00.000Z`),
    toDate: new Date(`${toYmd}T23:59:59.999Z`),
  };
}

function emptyAgentSummary() {
  return {
    conversationsHandled: 0,
    aiReplies: 0,
    handoffs: 0,
    inHumanMode: 0,
  };
}

function summarizeAgents(
  agents: AgentPerformanceRow[],
): ReturnType<typeof emptyAgentSummary> {
  return agents.reduce(
    (acc, row) => ({
      conversationsHandled: acc.conversationsHandled + row.conversationsHandled,
      aiReplies: acc.aiReplies + row.aiReplies,
      handoffs: acc.handoffs + row.handoffs,
      inHumanMode: acc.inHumanMode + row.inHumanMode,
    }),
    emptyAgentSummary(),
  );
}

export async function getAgentPerformanceReport(
  workspaceId: string,
  fromYmd: string,
  toYmd: string,
  agentId?: string | null,
): Promise<{ ok: true; report: AgentPerformanceReport } | { ok: false; message: string }> {
  try {
    const { fromDate, toDate } = reportDateBounds(fromYmd, toYmd);

    const agentRowsAll = await db
      .select({
        id: agentConfigs.id,
        profileName: agentConfigs.profileName,
      })
      .from(agentConfigs)
      .where(and(eq(agentConfigs.workspaceId, workspaceId), isNull(agentConfigs.archivedAt)));
    const agentOptions = agentRowsAll
      .map((row) => ({ id: row.id, name: row.profileName }))
      .sort((a, b) => a.name.localeCompare(b.name));
    // The agents table narrows to the selected agent; the dropdown keeps all.
    const agentRows = agentId
      ? agentRowsAll.filter((row) => row.id === agentId)
      : agentRowsAll;

    const aiAgg = await db
      .select({
        agentId: whatsappConnections.agentConfigId,
        aiReplies: sql<number>`count(*)::int`,
        conversationsHandled: sql<number>`count(distinct ${messages.conversationId})::int`,
      })
      .from(messages)
      .innerJoin(conversations, eq(messages.conversationId, conversations.id))
      .innerJoin(
        whatsappConnections,
        eq(conversations.whatsappConnectionId, whatsappConnections.id),
      )
      .where(
        and(
          eq(messages.workspaceId, workspaceId),
          eq(messages.outgoingSenderType, "ai_agent"),
          // Failed sends are technical errors, not successful AI replies.
          isNull(messages.status),
          gte(messages.createdAt, fromDate),
          lte(messages.createdAt, toDate),
          isNotNull(whatsappConnections.agentConfigId),
          agentId ? eq(whatsappConnections.agentConfigId, agentId) : undefined,
        ),
      )
      .groupBy(whatsappConnections.agentConfigId);

    const handoffAgg = await db
      .select({
        agentId: whatsappConnections.agentConfigId,
        handoffs: sql<number>`count(*)::int`,
      })
      .from(messages)
      .innerJoin(conversations, eq(messages.conversationId, conversations.id))
      .innerJoin(
        whatsappConnections,
        eq(conversations.whatsappConnectionId, whatsappConnections.id),
      )
      .where(
        and(
          eq(messages.workspaceId, workspaceId),
          sql`${messages.metadata}->>'thread_event' = ${THREAD_EVENT_HANDOFF_TO_HUMAN}`,
          gte(messages.createdAt, fromDate),
          lte(messages.createdAt, toDate),
          isNotNull(whatsappConnections.agentConfigId),
          agentId ? eq(whatsappConnections.agentConfigId, agentId) : undefined,
        ),
      )
      .groupBy(whatsappConnections.agentConfigId);

    const humanAgg = await db
      .select({
        agentId: whatsappConnections.agentConfigId,
        inHumanMode: sql<number>`count(*)::int`,
      })
      .from(conversations)
      .innerJoin(
        whatsappConnections,
        eq(conversations.whatsappConnectionId, whatsappConnections.id),
      )
      .where(
        and(
          eq(conversations.workspaceId, workspaceId),
          eq(conversations.handlingMode, "human"),
          isNull(conversations.archivedAt),
          isNotNull(whatsappConnections.agentConfigId),
          agentId ? eq(whatsappConnections.agentConfigId, agentId) : undefined,
        ),
      )
      .groupBy(whatsappConnections.agentConfigId);

    // Volume metrics: conversations/messages touched in the range. Failed
    // sends are excluded (they are counted as technical errors instead).
    // Workspace-wide when no agent filter; agent-scoped via the connection
    // chain otherwise.
    const volumeAgg = agentId
      ? await db
          .select({
            totalConversations: sql<number>`count(distinct ${messages.conversationId})::int`,
            totalMessages: sql<number>`count(*)::int`,
          })
          .from(messages)
          .innerJoin(conversations, eq(messages.conversationId, conversations.id))
          .innerJoin(
            whatsappConnections,
            eq(conversations.whatsappConnectionId, whatsappConnections.id),
          )
          .where(
            and(
              eq(messages.workspaceId, workspaceId),
              isNull(messages.status),
              gte(messages.createdAt, fromDate),
              lte(messages.createdAt, toDate),
              eq(whatsappConnections.agentConfigId, agentId),
            ),
          )
      : await db
          .select({
            totalConversations: sql<number>`count(distinct ${messages.conversationId})::int`,
            totalMessages: sql<number>`count(*)::int`,
          })
          .from(messages)
          .where(
            and(
              eq(messages.workspaceId, workspaceId),
              isNull(messages.status),
              gte(messages.createdAt, fromDate),
              lte(messages.createdAt, toDate),
            ),
          );

    const technicalErrorsAgg = agentId
      ? await db
          .select({ total: sql<number>`count(*)::int` })
          .from(messages)
          .innerJoin(conversations, eq(messages.conversationId, conversations.id))
          .innerJoin(
            whatsappConnections,
            eq(conversations.whatsappConnectionId, whatsappConnections.id),
          )
          .where(
            and(
              eq(messages.workspaceId, workspaceId),
              eq(messages.status, "failed"),
              gte(messages.createdAt, fromDate),
              lte(messages.createdAt, toDate),
              eq(whatsappConnections.agentConfigId, agentId),
            ),
          )
      : await db
          .select({ total: sql<number>`count(*)::int` })
          .from(messages)
          .where(
            and(
              eq(messages.workspaceId, workspaceId),
              eq(messages.status, "failed"),
              gte(messages.createdAt, fromDate),
              lte(messages.createdAt, toDate),
            ),
          );

    const reportedErrorsAgg = agentId
      ? await db
          .select({ total: sql<number>`count(*)::int` })
          .from(conversationReports)
          .innerJoin(conversations, eq(conversationReports.conversationId, conversations.id))
          .innerJoin(
            whatsappConnections,
            eq(conversations.whatsappConnectionId, whatsappConnections.id),
          )
          .where(
            and(
              eq(conversationReports.workspaceId, workspaceId),
              gte(conversationReports.createdAt, fromDate),
              lte(conversationReports.createdAt, toDate),
              eq(whatsappConnections.agentConfigId, agentId),
            ),
          )
      : await db
          .select({ total: sql<number>`count(*)::int` })
          .from(conversationReports)
          .where(
            and(
              eq(conversationReports.workspaceId, workspaceId),
              gte(conversationReports.createdAt, fromDate),
              lte(conversationReports.createdAt, toDate),
            ),
          );

    const aiByAgent = new Map(
      aiAgg
        .filter((r) => r.agentId)
        .map((r) => [
          r.agentId as string,
          {
            aiReplies: Number(r.aiReplies) || 0,
            conversationsHandled: Number(r.conversationsHandled) || 0,
          },
        ]),
    );
    const handoffsByAgent = new Map(
      handoffAgg
        .filter((r) => r.agentId)
        .map((r) => [r.agentId as string, Number(r.handoffs) || 0]),
    );
    const humanByAgent = new Map(
      humanAgg
        .filter((r) => r.agentId)
        .map((r) => [r.agentId as string, Number(r.inHumanMode) || 0]),
    );

    const agents: AgentPerformanceRow[] = agentRows
      .map((row) => {
        const ai = aiByAgent.get(row.id) ?? { aiReplies: 0, conversationsHandled: 0 };
        return {
          id: row.id,
          name: row.profileName,
          conversationsHandled: ai.conversationsHandled,
          aiReplies: ai.aiReplies,
          handoffs: handoffsByAgent.get(row.id) ?? 0,
          inHumanMode: humanByAgent.get(row.id) ?? 0,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    const topicAgg = agentId
      ? await db
          .select({
            entryId: sql<string | null>`${messages.metadata}->>'handoff_topic_entry_id'`,
            handoffs: sql<number>`count(*)::int`,
          })
          .from(messages)
          .innerJoin(conversations, eq(messages.conversationId, conversations.id))
          .innerJoin(
            whatsappConnections,
            eq(conversations.whatsappConnectionId, whatsappConnections.id),
          )
          .where(
            and(
              eq(messages.workspaceId, workspaceId),
              sql`${messages.metadata}->>'thread_event' = ${THREAD_EVENT_HANDOFF_TO_HUMAN}`,
              gte(messages.createdAt, fromDate),
              lte(messages.createdAt, toDate),
              eq(whatsappConnections.agentConfigId, agentId),
            ),
          )
          .groupBy(sql`${messages.metadata}->>'handoff_topic_entry_id'`)
      : await db
          .select({
            entryId: sql<string | null>`${messages.metadata}->>'handoff_topic_entry_id'`,
            handoffs: sql<number>`count(*)::int`,
          })
          .from(messages)
          .where(
            and(
              eq(messages.workspaceId, workspaceId),
              sql`${messages.metadata}->>'thread_event' = ${THREAD_EVENT_HANDOFF_TO_HUMAN}`,
              gte(messages.createdAt, fromDate),
              lte(messages.createdAt, toDate),
            ),
          )
          .groupBy(sql`${messages.metadata}->>'handoff_topic_entry_id'`);

    const entryIds = topicAgg
      .map((r) => r.entryId)
      .filter((id): id is string => typeof id === "string" && id.length > 0);

    const entryMeta = new Map<
      string,
      { topicName: string; groupName: string; groupId: string }
    >();
    if (entryIds.length > 0) {
      const entryRows = await db
        .select({
          id: workspaceHandoffTopicEntries.id,
          topicName: workspaceHandoffTopicEntries.title,
          groupName: workspaceHandoffTopicGroups.name,
          groupId: workspaceHandoffTopicGroups.id,
        })
        .from(workspaceHandoffTopicEntries)
        .innerJoin(
          workspaceHandoffTopicGroups,
          eq(workspaceHandoffTopicEntries.groupId, workspaceHandoffTopicGroups.id),
        )
        .where(
          and(
            eq(workspaceHandoffTopicGroups.workspaceId, workspaceId),
            inArray(workspaceHandoffTopicEntries.id, entryIds),
          ),
        );

      for (const row of entryRows) {
        entryMeta.set(row.id, {
          topicName: row.topicName,
          groupName: row.groupName,
          groupId: row.groupId,
        });
      }
    }

    let otherHandoffs = 0;
    const topics: HandoffTopicPerformanceRow[] = [];
    for (const row of topicAgg) {
      const count = Number(row.handoffs) || 0;
      if (count <= 0) continue;
      const entryId = row.entryId?.trim() || "";
      const meta = entryId ? entryMeta.get(entryId) : undefined;
      if (!meta) {
        otherHandoffs += count;
        continue;
      }
      topics.push({
        id: entryId,
        topicName: meta.topicName,
        groupName: meta.groupName.trim() || "-",
        groupId: meta.groupId,
        handoffs: count,
      });
    }
    if (otherHandoffs > 0) {
      topics.push({
        id: REPORTS_OTHER_TOPIC_ID,
        topicName: REPORTS_NO_TOPIC_LABEL,
        groupName: "-",
        groupId: null,
        handoffs: otherHandoffs,
      });
    }
    topics.sort((a, b) => b.handoffs - a.handoffs || a.topicName.localeCompare(b.topicName));

    const summary: AgentPerformanceSummary = {
      ...summarizeAgents(agents),
      totalConversations: Number(volumeAgg[0]?.totalConversations) || 0,
      totalMessages: Number(volumeAgg[0]?.totalMessages) || 0,
      technicalErrors: Number(technicalErrorsAgg[0]?.total) || 0,
      reportedErrors: Number(reportedErrorsAgg[0]?.total) || 0,
    };
    console.info(
      `[${scope}/getAgentPerformanceReport] Success: workspaceId=${workspaceId} agents=${agents.length} agentId=${agentId ?? "all"} totalConversations=${summary.totalConversations} totalMessages=${summary.totalMessages} technicalErrors=${summary.technicalErrors} reportedErrors=${summary.reportedErrors}`,
    );
    return { ok: true, report: { agents, topics, summary, agentOptions } };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[${scope}/getAgentPerformanceReport] Unexpected error: ${message}`);
    return { ok: false, message };
  }
}
