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
  contacts,
  conversationReports,
  conversations,
  profiles,
  users,
  whatsappConnections,
  workspaces,
} = await import("../db/schema/index.js");
const {
  createConversationReport,
  listConversationReportsForConversation,
  listConversationReportsForWorkspace,
} = await import("./conversation-reports.js");

const userId = randomUUID();
const otherUserId = randomUUID();
const workspaceId = randomUUID();
const otherWorkspaceId = randomUUID();
const agentId = randomUUID();
const connectionId = randomUUID();
const conversationId = randomUUID();
const unlinkedConversationId = randomUUID();

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
  await db.delete(workspaces).where(eq(workspaces.id, otherWorkspaceId));
  await db.delete(users).where(eq(users.id, userId));
  await db.delete(users).where(eq(users.id, otherUserId));
}

describe.skipIf(!hasDb)("conversation reports (real DB)", () => {
  beforeAll(async () => {
    await cleanup();

    await db.insert(users).values([
      {
        id: userId,
        email: `reports-repo-it-${userId.slice(0, 8)}@example.com`,
      },
      {
        id: otherUserId,
        email: `reports-repo-it-${otherUserId.slice(0, 8)}@example.com`,
      },
    ]);
    await db.insert(profiles).values({
      id: userId,
      firstName: "Deven",
      lastName: "Mendoza",
    });
    await db.insert(workspaces).values([
      { id: workspaceId, name: "Reports Repo IT", ownerUserId: userId },
      { id: otherWorkspaceId, name: "Reports Repo IT Other", ownerUserId: otherUserId },
    ]);
    await db.insert(agentConfigs).values({
      id: agentId,
      workspaceId,
      profileName: "Reports Bot",
    });
    await db.insert(whatsappConnections).values({
      id: connectionId,
      workspaceId,
      displayName: "Line 1",
      agentConfigId: agentId,
      mode: "live",
      status: "open",
    });
    await db.insert(conversations).values([
      {
        id: conversationId,
        workspaceId,
        title: "Customer chat",
        whatsappConnectionId: connectionId,
        whatsappChatId: `chat-${conversationId.slice(0, 8)}`,
      },
      {
        id: unlinkedConversationId,
        workspaceId,
        title: "Unlinked chat",
        whatsappChatId: `chat-${unlinkedConversationId.slice(0, 8)}`,
      },
    ]);

    const inserted = await db
      .select({ id: conversations.id, title: conversations.title })
      .from(conversations)
      .where(eq(conversations.workspaceId, workspaceId));
    const linked = inserted.find((c) => c.title === "Customer chat");
    const unlinked = inserted.find((c) => c.title === "Unlinked chat");
    if (!linked || !unlinked) throw new Error("seed conversations missing");

    await db.insert(contacts).values({
      workspaceId,
      firstName: "Amara",
      lastName: "Okafor",
      phone: "+15550000001",
    });
    const contactRows = await db
      .select({ id: contacts.id })
      .from(contacts)
      .where(eq(contacts.workspaceId, workspaceId));
    await db
      .update(conversations)
      .set({ contactId: contactRows[0]?.id })
      .where(eq(conversations.id, linked.id));

    const inRange = new Date("2026-07-15T12:00:00.000Z");
    const inRangeLater = new Date("2026-07-15T13:00:00.000Z");
    const outOfRange = new Date("2026-06-01T12:00:00.000Z");

    await db.insert(conversationReports).values([
      {
        workspaceId,
        conversationId: linked.id,
        reportedByUserId: userId,
        reason: "Wrong refund policy quoted",
        createdAt: inRange,
      },
      {
        workspaceId,
        conversationId: linked.id,
        reportedByUserId: otherUserId,
        reason: "AI looped the same answer",
        createdAt: inRangeLater,
      },
      {
        workspaceId,
        conversationId: unlinked.id,
        reportedByUserId: userId,
        reason: "Report without an agent link",
        createdAt: inRange,
      },
      {
        workspaceId,
        conversationId: linked.id,
        reportedByUserId: userId,
        reason: "Old report outside the range",
        createdAt: outOfRange,
      },
    ]);
  });

  afterAll(async () => {
    await cleanup();
  });

  // Creating a report resolves the reporter display name from the profile.
  it("creates a report and resolves the reporter name", async () => {
    const result = await createConversationReport({
      workspaceId,
      conversationId,
      reportedByUserId: userId,
      reason: "Agent misunderstood the address",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.report.reason).toBe("Agent misunderstood the address");
    expect(result.report.reportedByName).toBe("Deven Mendoza");
    expect(result.report.createdAt).toBeTruthy();
  });

  // A conversation from another workspace must not be reportable — scoping guard.
  it("rejects reporting a conversation outside the workspace", async () => {
    const result = await createConversationReport({
      workspaceId: otherWorkspaceId,
      conversationId,
      reportedByUserId: otherUserId,
      reason: "Should not be allowed",
    });
    expect(result).toEqual({ ok: false, message: "conversation_not_found" });
  });

  // History listing returns newest-first entries with reporter names.
  it("lists report history for a conversation newest first", async () => {
    const reports = await listConversationReportsForConversation(workspaceId, conversationId);
    expect(reports.length).toBeGreaterThanOrEqual(2);
    expect(reports[0].reason).toBe("Agent misunderstood the address");
    expect(reports[0].reportedByName).toBe("Deven Mendoza");
    const createdAtList = reports.map((r) => r.createdAt);
    expect([...createdAtList].sort().reverse()).toEqual(createdAtList);
  });

  // Workspace listing respects the date window and total count.
  it("lists workspace reports within the date range with total", async () => {
    const page = await listConversationReportsForWorkspace(workspaceId, {
      fromDate: new Date("2026-07-01T00:00:00.000Z"),
      toDate: new Date("2026-07-31T23:59:59.999Z"),
      limit: 25,
      offset: 0,
    });
    expect(page.total).toBeGreaterThanOrEqual(3);
    const byReason = new Map(page.reports.map((r) => [r.reason, r]));
    const linked = byReason.get("Wrong refund policy quoted");
    expect(linked?.conversationName).toBe("Customer chat");
    expect(linked?.contactName).toBe("Amara Okafor");
    expect(linked?.agentName).toBe("Reports Bot");
    expect(linked?.agentId).toBe(agentId);
    expect(byReason.get("Report without an agent link")?.agentId).toBeNull();
    expect(byReason.get("Report without an agent link")?.agentName).toBeNull();
  });

  // Agent filter excludes reports on conversations without that agent link.
  it("scopes the workspace listing to a specific agent", async () => {
    const page = await listConversationReportsForWorkspace(workspaceId, {
      fromDate: new Date("2026-07-01T00:00:00.000Z"),
      toDate: new Date("2026-07-31T23:59:59.999Z"),
      agentId,
      limit: 25,
      offset: 0,
    });
    expect(page.reports.every((r) => r.agentId === agentId)).toBe(true);
    expect(page.total).toBeGreaterThanOrEqual(2);
    expect(page.reports.some((r) => r.reason === "Report without an agent link")).toBe(false);
  });

  // Out-of-range reports never appear in the window.
  it("excludes reports outside the date range", async () => {
    const page = await listConversationReportsForWorkspace(workspaceId, {
      fromDate: new Date("2026-07-01T00:00:00.000Z"),
      toDate: new Date("2026-07-31T23:59:59.999Z"),
      limit: 25,
      offset: 0,
    });
    expect(page.reports.some((r) => r.reason === "Old report outside the range")).toBe(false);
  });
});