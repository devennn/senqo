import { randomUUID } from "node:crypto";
import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { eq, sql } from "drizzle-orm";
import { loadRepoDatabaseUrl } from "../lib/load-repo-env.js";

loadRepoDatabaseUrl();
const databaseUrl = process.env.DATABASE_URL ?? "";
if (databaseUrl.includes("@postgres:")) {
  process.env.DATABASE_URL = databaseUrl.replace("@postgres:", "@127.0.0.1:");
}

const { db } = await import("../db/index.js");
const {
  agentConfigs,
  conversations,
  messages,
  users,
  whatsappConnections,
  workspaceHandoffTopicEntries,
  workspaceHandoffTopicGroups,
  workspaces,
} = await import("../db/schema/index.js");
const { THREAD_EVENT_HANDOFF_TO_HUMAN } = await import("../lib/conversation-thread-events.js");
const { getAgentPerformanceReport } = await import("./reports.js");
const { REPORTS_OTHER_TOPIC_ID } = await import("../types/reports.js");

const userId = randomUUID();
const workspaceId = randomUUID();
const agentId = randomUUID();
const idleAgentId = randomUUID();
const connectionId = randomUUID();
const conversationId = randomUUID();
const groupId = randomUUID();
const entryId = randomUUID();

async function dbAvailable(): Promise<boolean> {
  try {
    await db.execute(sql`select 1`);
    return true;
  } catch {
    return false;
  }
}

const hasDb = await dbAvailable();

async function cleanup(): Promise<void> {
  await db.delete(workspaces).where(eq(workspaces.id, workspaceId));
  await db.delete(users).where(eq(users.id, userId));
}

describe.skipIf(!hasDb)("getAgentPerformanceReport (real DB)", () => {
  beforeAll(async () => {
    await cleanup();

    await db.insert(users).values({
      id: userId,
      email: `reports-it-${userId.slice(0, 8)}@example.com`,
    });
    await db.insert(workspaces).values({
      id: workspaceId,
      name: "Reports IT Workspace",
      ownerUserId: userId,
    });
    await db.insert(agentConfigs).values([
      {
        id: agentId,
        workspaceId,
        profileName: "Reports Bot",
        handoffTopicGroups: [groupId],
      },
      {
        id: idleAgentId,
        workspaceId,
        profileName: "Idle Bot",
      },
    ]);
    await db.insert(workspaceHandoffTopicGroups).values({
      id: groupId,
      workspaceId,
      name: "Billing",
    });
    await db.insert(workspaceHandoffTopicEntries).values({
      id: entryId,
      groupId,
      title: "Refund request",
      description: "Customer wants money back",
      sortOrder: 0,
    });
    await db.insert(whatsappConnections).values({
      id: connectionId,
      workspaceId,
      displayName: "Line 1",
      agentConfigId: agentId,
      mode: "live",
      status: "open",
    });
    await db.insert(conversations).values({
      id: conversationId,
      workspaceId,
      title: "Customer chat",
      whatsappConnectionId: connectionId,
      whatsappChatId: `chat-${conversationId.slice(0, 8)}`,
      handlingMode: "human",
    });

    const inRange = new Date("2026-07-15T12:00:00.000Z");
    const outOfRange = new Date("2026-06-01T12:00:00.000Z");

    await db.insert(messages).values([
      {
        workspaceId,
        conversationId,
        role: "assistant",
        content: "Hello",
        outgoingSenderType: "ai_agent",
        createdAt: inRange,
        metadata: { source: "agent_tool_send_whatsapp" },
      },
      {
        workspaceId,
        conversationId,
        role: "assistant",
        content: "Follow up",
        outgoingSenderType: "ai_agent",
        createdAt: inRange,
        metadata: { source: "agent_tool_send_whatsapp" },
      },
      {
        workspaceId,
        conversationId,
        role: "assistant",
        content: "Old reply",
        outgoingSenderType: "ai_agent",
        createdAt: outOfRange,
        metadata: { source: "agent_tool_send_whatsapp" },
      },
      {
        workspaceId,
        conversationId,
        role: "assistant",
        content: "Human handoff",
        outgoingSenderType: null,
        createdAt: inRange,
        metadata: {
          thread_event: THREAD_EVENT_HANDOFF_TO_HUMAN,
          handoff_tool_reason: "Refund request",
          handoff_topic_entry_id: entryId,
        },
      },
      {
        workspaceId,
        conversationId,
        role: "assistant",
        content: "Human handoff",
        outgoingSenderType: null,
        createdAt: inRange,
        metadata: {
          thread_event: THREAD_EVENT_HANDOFF_TO_HUMAN,
          handoff_tool_reason: "Unsupported media",
        },
      },
    ]);
  });

  afterAll(async () => {
    await cleanup();
  });

  // Seeded AI replies + handoffs in range map onto the bound agent; idle agent stays zeroed.
  it("aggregates agent metrics and topic volume from seeded rows", async () => {
    const result = await getAgentPerformanceReport(workspaceId, "2026-07-01", "2026-07-31");
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const bot = result.report.agents.find((a) => a.id === agentId);
    const idle = result.report.agents.find((a) => a.id === idleAgentId);
    expect(bot).toEqual({
      id: agentId,
      name: "Reports Bot",
      conversationsHandled: 1,
      aiReplies: 2,
      handoffs: 2,
      inHumanMode: 1,
    });
    expect(idle).toEqual({
      id: idleAgentId,
      name: "Idle Bot",
      conversationsHandled: 0,
      aiReplies: 0,
      handoffs: 0,
      inHumanMode: 0,
    });
    expect(result.report.summary).toEqual({
      conversationsHandled: 1,
      aiReplies: 2,
      handoffs: 2,
      inHumanMode: 1,
    });
    expect(result.report.topics).toEqual([
      {
        id: REPORTS_OTHER_TOPIC_ID,
        topicName: "Other",
        groupName: "—",
        handoffs: 1,
      },
      {
        id: entryId,
        topicName: "Refund request",
        groupName: "Billing",
        handoffs: 1,
      },
    ]);
  });

  // Out-of-range window must ignore July activity — verifies date bounds on live SQL.
  it("returns zeros for a date range with no activity", async () => {
    const result = await getAgentPerformanceReport(workspaceId, "2026-01-01", "2026-01-31");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const bot = result.report.agents.find((a) => a.id === agentId);
    expect(bot?.aiReplies).toBe(0);
    expect(bot?.handoffs).toBe(0);
    expect(bot?.conversationsHandled).toBe(0);
    expect(result.report.topics).toEqual([]);
  });
});
