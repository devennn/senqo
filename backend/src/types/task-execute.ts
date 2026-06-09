/** Payload for scheduled task execution (pg-boss worker). */
export type TaskExecutePayload = {
  workspaceId: string;
  agentConfigId: string;
  message: string;
  fileUrl?: string;
  dryRun?: boolean;
  conversationId?: string;
  leadId?: string;
  taskId?: string;
  scheduledAt?: string;
};

export type TaskExecuteResult =
  | { ok: true; mode: string; skipped?: boolean }
  | { ok: false; error: string };

/** Stored on tasks.job_payload after scheduling. */
export type TaskJobPayload = {
  jobId: string;
  queue: "task-execute";
};
