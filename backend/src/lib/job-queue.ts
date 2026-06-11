import { PgBoss } from "pg-boss";
import { executeInboundDebouncedAiRun } from "../services/inbound-ai-debounce-run.js";
import { executeScheduledTask } from "../services/task-execute-run.js";
import type { TaskExecutePayload } from "../types/task-execute.js";
import { env } from "./env.js";

export const QUEUE_INBOUND_AI = "inbound-ai";
export const QUEUE_TASK_EXECUTE = "task-execute";

export type InboundAiJobData = {
  workspaceId: string;
  conversationId: string;
  agentConfigId: string;
  /** Line that received the inbound; omitted on jobs queued before multi-connection scoping. */
  whatsappConnectionId?: string;
};

let boss: PgBoss | null = null;

export function getBoss(): PgBoss {
  if (!boss) {
    throw new Error("Job queue is not started");
  }
  return boss;
}

export async function startJobQueue(): Promise<void> {
  if (boss) {
    return;
  }

  const instance = new PgBoss({ connectionString: env.databaseUrl });
  instance.on("error", (error) => {
    console.error(`[JobQueue/start] Unexpected error: ${String(error)}`);
  });

  await instance.start();

  await instance.createQueue(QUEUE_INBOUND_AI, {
    expireInSeconds: 3600,
    retryLimit: 1,
  });
  await instance.createQueue(QUEUE_TASK_EXECUTE, {
    expireInSeconds: 3600,
    retryLimit: 2,
    retryBackoff: true,
  });

  await instance.work<InboundAiJobData>(QUEUE_INBOUND_AI, async (jobs) => {
    for (const job of jobs) {
      const result = await executeInboundDebouncedAiRun(job.data);
      if (!result.ok) {
        console.error(
          `[JobQueue/work/inbound-ai] Failed query: conversationId=${job.data.conversationId} error=${result.error ?? "failed"}`,
        );
        throw new Error(result.error ?? "inbound_ai_debounce_failed");
      }
    }
  });

  await instance.work<TaskExecutePayload>(QUEUE_TASK_EXECUTE, async (jobs) => {
    for (const job of jobs) {
      const result = await executeScheduledTask(job.data);
      if (!result.ok) {
        console.error(
          `[JobQueue/work/task-execute] Failed query: taskId=${job.data.taskId ?? "none"} error=${result.error}`,
        );
        throw new Error(result.error);
      }
      console.info(
        `[JobQueue/work/task-execute] Success: taskId=${job.data.taskId ?? "none"} mode=${result.mode}`,
      );
    }
  });

  boss = instance;
  console.info("[JobQueue/start] Success: pg-boss workers registered");
}

export async function stopJobQueue(): Promise<void> {
  if (!boss) {
    return;
  }
  try {
    await boss.stop({ graceful: true, timeout: 30_000 });
    console.info("[JobQueue/stop] Success");
  } catch (error) {
    console.error(`[JobQueue/stop] Unexpected error: ${String(error)}`);
  } finally {
    boss = null;
  }
}
