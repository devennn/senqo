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
const {
  listConversationMessagesBareForAi,
  listConversationMessagesLatestPage,
  listConversationMessagesOlderPage,
} = await import("./conversations.js");

const userId = randomUUID();
const workspaceId = randomUUID();
const conversationId = randomUUID();

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

describe.skipIf(!hasDb)("conversation thread reads (real DB)", () => {
  beforeAll(async () => {
    await cleanup();

    await db.insert(users).values({
      id: userId,
      email: `thread-it-${userId.slice(0, 8)}@example.com`,
    });
    await db.insert(workspaces).values({
      id: workspaceId,
      name: "Thread IT",
      ownerUserId: userId,
    });
    await db.insert(conversations).values({
      id: conversationId,
      workspaceId,
      title: "Thread IT chat",
      updatedAt: new Date("2026-08-03T10:05:00Z"),
    });
    await db.insert(messages).values([
      {
        workspaceId,
        conversationId,
        role: "user",
        content: "Customer question",
        createdAt: new Date("2026-08-03T10:00:00Z"),
      },
      {
        workspaceId,
        conversationId,
        role: "assistant",
        content: "Dry run draft reply",
        outgoingSenderType: "ai_agent",
        status: "dry_run",
        metadata: { source: "agent_dry_run", dry_run: true },
        createdAt: new Date("2026-08-03T10:01:00Z"),
      },
      {
        workspaceId,
        conversationId,
        role: "assistant",
        content: "Failed send that must stay hidden",
        outgoingSenderType: "ai_agent",
        status: "failed",
        createdAt: new Date("2026-08-03T10:02:00Z"),
      },
    ]);
  });

  afterAll(async () => {
    await cleanup();
  });

  // The thread must include dry-run drafts (operators review them) while failed
  // sends stay hidden as technical errors.
  it("includes dry-run drafts and hides failed rows in the latest page", async () => {
    const result = await listConversationMessagesLatestPage(workspaceId, conversationId, 10);

    expect(result.messages.map((m) => m.content)).toEqual([
      "Customer question",
      "Dry run draft reply",
    ]);
  });

  // Older pages use the same visibility rule so scrolling back never drops a draft.
  it("includes dry-run drafts in older pages", async () => {
    const result = await listConversationMessagesOlderPage(
      workspaceId,
      conversationId,
      10,
      "2026-08-03T10:03:00.000Z",
      randomUUID(),
    );

    expect(result.messages.map((m) => m.content)).toEqual([
      "Customer question",
      "Dry run draft reply",
    ]);
  });

  // Drafts were never sent to the customer, so they must not become AI context.
  it("excludes dry-run drafts from bare messages for AI", async () => {
    const bare = await listConversationMessagesBareForAi(workspaceId, conversationId);

    expect(bare.map((m) => m.content)).toEqual(["Customer question"]);
  });
});
