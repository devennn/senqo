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
const { conversations, messages, users, workspaces } = await import("../db/schema/index.js");
const { listConversations } = await import("./conversations.js");

const userId = randomUUID();
const workspaceId = randomUUID();
const otherWorkspaceId = randomUUID();
const emptyWorkspaceId = randomUUID();

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
  await db.delete(workspaces).where(eq(workspaces.id, emptyWorkspaceId));
  await db.delete(users).where(eq(users.id, userId));
}

describe.skipIf(!hasDb)("listConversations (real DB)", () => {
  beforeAll(async () => {
    await cleanup();

    await db.insert(users).values({
      id: userId,
      email: `conversations-it-${userId.slice(0, 8)}@example.com`,
    });
    await db.insert(workspaces).values([
      { id: workspaceId, name: "Conversations IT", ownerUserId: userId },
      { id: otherWorkspaceId, name: "Conversations IT Other", ownerUserId: userId },
      { id: emptyWorkspaceId, name: "Conversations IT Empty", ownerUserId: userId },
    ]);

    // Three active conversations with distinct updatedAt ordering (newest first),
    // one archived conversation that must never appear, and one conversation in
    // a different workspace that must never appear.
    await db.insert(conversations).values([
      {
        workspaceId,
        title: "Chat newest",
        updatedAt: new Date("2026-08-03T10:00:00Z"),
      },
      {
        workspaceId,
        title: "Chat middle",
        updatedAt: new Date("2026-08-02T10:00:00Z"),
      },
      {
        workspaceId,
        title: "Chat oldest",
        updatedAt: new Date("2026-08-01T10:00:00Z"),
      },
      {
        workspaceId,
        title: "Chat archived",
        updatedAt: new Date("2026-08-04T10:00:00Z"),
        archivedAt: new Date("2026-08-04T11:00:00Z"),
      },
      {
        workspaceId: otherWorkspaceId,
        title: "Chat other workspace",
        updatedAt: new Date("2026-08-03T11:00:00Z"),
      },
    ]);
  });

  afterAll(async () => {
    await cleanup();
  });

  // First page with a limit smaller than the result set → page rows, hasMore true, and total counts only unarchived rows.
  it("returns first page with hasMore and total", async () => {
    const result = await listConversations(workspaceId, { limit: 2, offset: 0 });

    expect(result.conversations).toHaveLength(2);
    expect(result.hasMore).toBe(true);
    expect(result.total).toBe(3);
    expect(result.conversations.map((c) => c.title)).toEqual(["Chat newest", "Chat middle"]);
  });

  // Offset paging continues where the first page stopped and reports the end of the list.
  it("returns second page with hasMore false at the end", async () => {
    const result = await listConversations(workspaceId, { limit: 2, offset: 2 });

    expect(result.conversations.map((c) => c.title)).toEqual(["Chat oldest"]);
    expect(result.hasMore).toBe(false);
    expect(result.total).toBe(3);
  });

  // The newest message of each conversation becomes the preview, not older ones.
  it("attaches the latest message preview per conversation", async () => {
    const inserted = await db
      .select({ id: conversations.id, title: conversations.title })
      .from(conversations)
      .where(eq(conversations.workspaceId, workspaceId));
    const newest = inserted.find((c) => c.title === "Chat newest");
    const middle = inserted.find((c) => c.title === "Chat middle");
    expect(newest).toBeDefined();
    expect(middle).toBeDefined();

    await db.insert(messages).values([
      {
        workspaceId,
        conversationId: newest!.id,
        role: "user",
        content: "older question",
        createdAt: new Date("2026-08-03T09:00:00Z"),
      },
      {
        workspaceId,
        conversationId: newest!.id,
        role: "assistant",
        content: "newest reply",
        createdAt: new Date("2026-08-03T09:30:00Z"),
      },
      {
        workspaceId,
        conversationId: middle!.id,
        role: "user",
        content: "middle chat message",
        createdAt: new Date("2026-08-02T09:00:00Z"),
      },
    ]);

    const result = await listConversations(workspaceId, { limit: 10, offset: 0 });

    const newestRow = result.conversations.find((c) => c.title === "Chat newest");
    const middleRow = result.conversations.find((c) => c.title === "Chat middle");
    expect(newestRow?.lastMessage?.content).toBe("newest reply");
    expect(newestRow?.lastMessage?.isOutbound).toBe(true);
    expect(middleRow?.lastMessage?.content).toBe("middle chat message");
  });

  // An empty workspace returns the zeroed envelope instead of an empty array, needed so the rail renders its empty state.
  it("returns zeroed envelope when workspace has no conversations", async () => {
    const result = await listConversations(emptyWorkspaceId, { limit: 25, offset: 0 });

    expect(result.conversations).toEqual([]);
    expect(result.hasMore).toBe(false);
    expect(result.total).toBe(0);
  });

  // Failed sends (status="failed") are technical errors and must never become
  // the rail preview — the newest visible message stays the preview.
  it("excludes failed sends from the latest message preview", async () => {
    const inserted = await db
      .select({ id: conversations.id, title: conversations.title })
      .from(conversations)
      .where(eq(conversations.workspaceId, workspaceId));
    const middle = inserted.find((c) => c.title === "Chat middle");
    expect(middle).toBeDefined();

    await db.insert(messages).values([
      {
        workspaceId,
        conversationId: middle!.id,
        role: "assistant",
        content: "Failed send that must not show",
        outgoingSenderType: "ai_agent",
        status: "failed",
        createdAt: new Date("2026-08-02T12:00:00Z"),
      },
    ]);

    const result = await listConversations(workspaceId, { limit: 10, offset: 0 });
    const middleRow = result.conversations.find((c) => c.title === "Chat middle");
    expect(middleRow?.lastMessage?.content).toBe("middle chat message");
  });
});
