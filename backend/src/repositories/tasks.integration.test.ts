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
const { tasks, users, workspaces, agentConfigs, whatsappConnections } = await import(
  "../db/schema/index.js"
);
const { cancelAndDetachTasksByConnection, listTasksForConnectionCleanup } = await import(
  "./tasks.js"
);
const { deleteConnectionByWorkspace } = await import("./whatsapp.js");

const userId = randomUUID();
const workspaceId = randomUUID();
const agentId = randomUUID();
const connectionId = randomUUID();
const activeTaskId = randomUUID();
const cancelledTaskId = randomUUID();

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
  await db.delete(tasks).where(eq(tasks.workspaceId, workspaceId));
  await db.delete(whatsappConnections).where(eq(whatsappConnections.workspaceId, workspaceId));
  await db.delete(workspaces).where(eq(workspaces.id, workspaceId));
  await db.delete(users).where(eq(users.id, userId));
}

afterAll(async () => {
  await cleanup();
});

describe.skipIf(!hasDb)("connection task cleanup (real DB)", () => {
  beforeAll(async () => {
    await cleanup();

    await db.insert(users).values({
      id: userId,
      email: `tasks-it-${userId.slice(0, 8)}@example.com`,
    });
    await db.insert(workspaces).values({
      id: workspaceId,
      name: "Tasks IT Workspace",
      ownerUserId: userId,
    });
    await db.insert(agentConfigs).values({ id: agentId, workspaceId });
    await db.insert(whatsappConnections).values({
      id: connectionId,
      workspaceId,
      displayName: "Line IT",
    });
    await db.insert(tasks).values([
      {
        id: activeTaskId,
        workspaceId,
        agentConfigId: agentId,
        whatsappConnectionId: connectionId,
        prompt: "Active task",
        scheduleType: "one_time",
        status: "active",
        jobPayload: { jobId: "job-active", queue: "task-execute" },
      },
      {
        id: cancelledTaskId,
        workspaceId,
        agentConfigId: agentId,
        whatsappConnectionId: connectionId,
        prompt: "Cancelled task",
        scheduleType: "one_time",
        status: "cancelled",
        jobPayload: { jobId: "job-cancelled", queue: "task-execute" },
      },
    ]);
  });

  // Only non-cancelled tasks still hold pending jobs — cancelled history must not be returned for cleanup.
  it("listTasksForConnectionCleanup → returns only the non-cancelled task", async () => {
    const rows = await listTasksForConnectionCleanup(workspaceId, connectionId);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: activeTaskId,
      jobPayload: { jobId: "job-active", queue: "task-execute" },
    });
  });

  // The delete flow depends on this: active rows become cancelled, every row loses the connection reference.
  it("cancelAndDetachTasksByConnection → cancels active and detaches all rows", async () => {
    const result = await cancelAndDetachTasksByConnection(workspaceId, connectionId);

    expect(result).toEqual({ ok: true, cancelled: 1 });

    const rows = await db.select().from(tasks).where(eq(tasks.workspaceId, workspaceId));
    const active = rows.find((row) => row.id === activeTaskId);
    const cancelled = rows.find((row) => row.id === cancelledTaskId);
    expect(active?.status).toBe("cancelled");
    expect(active?.whatsappConnectionId).toBeNull();
    expect(cancelled?.status).toBe("cancelled");
    expect(cancelled?.whatsappConnectionId).toBeNull();
  });

  // Regression: before the cleanup existed, this DELETE was rejected with a FK violation whenever any
  // task still referenced the connection — the exact cause of the "connection_delete_failed" error.
  it("deleteConnectionByWorkspace → succeeds after task cleanup", async () => {
    await cancelAndDetachTasksByConnection(workspaceId, connectionId);

    const result = await deleteConnectionByWorkspace(workspaceId, connectionId);

    expect(result).toEqual({ ok: true, message: "Connection deleted", deleted: true });
    const remaining = await db
      .select()
      .from(whatsappConnections)
      .where(eq(whatsappConnections.id, connectionId));
    expect(remaining).toHaveLength(0);
  });
});
