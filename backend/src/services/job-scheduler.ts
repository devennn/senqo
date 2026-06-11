import { env } from "../lib/env.js";
import { getBoss, QUEUE_INBOUND_AI, QUEUE_TASK_EXECUTE } from "../lib/job-queue.js";
import {
  getInboundAiDebouncePendingJobId,
  upsertInboundAiDebouncePending,
} from "../repositories/inbound-ai-debounce-pending.js";
import type { InboundAiJobData } from "../lib/job-queue.js";
import type { TaskExecutePayload, TaskJobPayload } from "../types/task-execute.js";

const scope = "JobScheduler";

export type ScheduleAgentTaskInput = {
  workspaceId: string;
  agentConfigId: string;
  prompt: string;
  fileUrl?: string | null;
  cronExpression: string | null;
  oneTimeAt: string | null;
  taskId: string;
  conversationId?: string | null;
  leadId?: string | null;
  scheduledAt?: string | null;
};

export type ScheduledAgentTask = {
  payload: TaskJobPayload;
};

export type ScheduleInboundAiDebouncedInput = {
  workspaceId: string;
  conversationId: string;
  agentConfigId: string;
  whatsappConnectionId: string;
};

function buildTaskExecutePayload(input: ScheduleAgentTaskInput): TaskExecutePayload {
  const body: TaskExecutePayload = {
    workspaceId: input.workspaceId,
    agentConfigId: input.agentConfigId,
    message: input.prompt,
    dryRun: false,
    taskId: input.taskId,
  };
  if (input.conversationId) {
    body.conversationId = input.conversationId;
  }
  if (input.leadId) {
    body.leadId = input.leadId;
  }
  if (input.scheduledAt) {
    body.scheduledAt = input.scheduledAt;
  }
  if (input.fileUrl) {
    body.fileUrl = input.fileUrl;
  }
  return body;
}

export async function scheduleAgentTask(input: ScheduleAgentTaskInput): Promise<ScheduledAgentTask> {
  const oneTimeAtMs = input.oneTimeAt ? new Date(input.oneTimeAt).getTime() : null;
  if (input.oneTimeAt && (oneTimeAtMs === null || Number.isNaN(oneTimeAtMs))) {
    throw new Error("Invalid oneTimeAt value for task scheduling.");
  }

  const delaySeconds =
    oneTimeAtMs !== null ? Math.max(0, Math.ceil((oneTimeAtMs - Date.now()) / 1000)) : 0;

  const body = buildTaskExecutePayload(input);
  const boss = getBoss();

  console.info(`[${scope}/scheduleAgentTask] Outgoing payload:`, {
    queue: QUEUE_TASK_EXECUTE,
    cron: input.cronExpression ?? null,
    delaySeconds,
    taskId: input.taskId,
  });

  let jobId: string | null;
  try {
    if (delaySeconds > 0) {
      jobId = await boss.sendAfter(QUEUE_TASK_EXECUTE, body, {}, delaySeconds);
    } else {
      jobId = await boss.send(QUEUE_TASK_EXECUTE, body);
    }
  } catch (error) {
    console.error(`[${scope}/scheduleAgentTask] Unexpected error: ${String(error)}`);
    throw error;
  }

  if (!jobId) {
    throw new Error("Failed to enqueue scheduled task.");
  }

  console.info(`[${scope}/scheduleAgentTask] Success: taskId=${input.taskId} jobId=${jobId}`);
  return {
    payload: {
      jobId,
      queue: QUEUE_TASK_EXECUTE,
    },
  };
}

export async function scheduleInboundAiDebouncedJob(
  input: ScheduleInboundAiDebouncedInput,
): Promise<void> {
  const prev = await getInboundAiDebouncePendingJobId(input.conversationId);
  if (prev) {
    await cancelJob(QUEUE_INBOUND_AI, prev);
  }

  const delaySeconds = Math.max(1, env.inboundAiDebounceSeconds);
  const data: InboundAiJobData = {
    workspaceId: input.workspaceId,
    conversationId: input.conversationId,
    agentConfigId: input.agentConfigId,
    whatsappConnectionId: input.whatsappConnectionId,
  };

  try {
    const jobId = await getBoss().send(QUEUE_INBOUND_AI, data, {
      startAfter: delaySeconds,
      singletonKey: input.conversationId,
    });
    if (!jobId) {
      console.error(`[${scope}/scheduleInboundAiDebouncedJob] Failed query: no job id returned`);
      return;
    }

    const saved = await upsertInboundAiDebouncePending({
      conversationId: input.conversationId,
      workspaceId: input.workspaceId,
      pendingJobId: jobId,
    });
    if (!saved) {
      console.error(`[${scope}/scheduleInboundAiDebouncedJob] Failed query: could not persist pending job id`);
    } else {
      console.info(
        `[${scope}/scheduleInboundAiDebouncedJob] Success: conversationId=${input.conversationId} jobId=${jobId}`,
      );
    }
  } catch (error) {
    console.error(`[${scope}/scheduleInboundAiDebouncedJob] Unexpected error: ${String(error)}`);
  }
}

export async function cancelJob(queue: string, jobId: string): Promise<void> {
  try {
    await getBoss().cancel(queue, jobId);
    console.info(`[${scope}/cancelJob] Success: queue=${queue} jobId=${jobId}`);
  } catch (error) {
    console.error(`[${scope}/cancelJob] Failed query: ${String(error)}`);
  }
}

export async function cancelScheduledTask(payload: Record<string, unknown>): Promise<void> {
  const jobId = typeof payload.jobId === "string" && payload.jobId.length > 0 ? payload.jobId : null;
  const queue =
    typeof payload.queue === "string" && payload.queue.length > 0
      ? payload.queue
      : QUEUE_TASK_EXECUTE;

  if (!jobId) {
    return;
  }

  await cancelJob(queue, jobId);
}
