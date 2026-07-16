import { runAgentSession } from "../agent/agent.js";
import { getConversationHandlingMode } from "../repositories/conversations.js";
import { getTaskById, recordTaskRun } from "../repositories/tasks.js";
import type { TaskExecutePayload, TaskExecuteResult } from "../types/task-execute.js";
import {
  buildTaskExecuteAgentMessage,
  buildWorkspaceScheduledAgentMessage,
} from "./task-execute-prompt.js";
import { sendScheduledTaskAsManualWhatsapp } from "./task-execute-manual.js";
import { runTaskOutreachBatch } from "./task-execute-outreach.js";
import { formatTaskOutboundMessage } from "./task-message-formatter.js";

const logScope = "TaskExecuteRun";

export async function executeScheduledTask(payload: TaskExecutePayload): Promise<TaskExecuteResult> {
  try {
    const dryRun = payload.dryRun ?? false;
    let effectiveLeadId = payload.leadId;
    let scheduledIso = payload.scheduledAt;

    const taskRow =
      payload.taskId != null ? await getTaskById(payload.workspaceId, payload.taskId) : null;

    if (taskRow && taskRow.status === "cancelled") {
      console.info(`[${logScope}] Skipped cancelled task execution`, { taskId: payload.taskId });
      return { ok: true, mode: "cancelled", skipped: true };
    }
    if (taskRow && taskRow.schedule_type === "recurring") {
      console.info(`[${logScope}] Skipped recurring task execution`, { taskId: payload.taskId });
      return { ok: true, mode: "unsupported_schedule", skipped: true };
    }
    if (taskRow) {
      if (!effectiveLeadId && taskRow.lead_id) effectiveLeadId = taskRow.lead_id;
      if (!scheduledIso && taskRow.one_time_at) scheduledIso = taskRow.one_time_at;
    }

    const scheduledAt = scheduledIso ?? new Date().toISOString();
    let formattedOutbound: { message: string; fileUrl: string | null } | null = null;

    async function getFormattedOutbound() {
      if (formattedOutbound) return formattedOutbound;
      if (taskRow?.source === "api") {
        formattedOutbound = {
          message: decodeURIComponent(payload.message)
            .replace(/\r\n/g, "\n")
            .replace(/\r/g, "\n"),
          fileUrl: payload.fileUrl ?? null,
        };
        return formattedOutbound;
      }
      formattedOutbound = await formatTaskOutboundMessage({
        message: payload.message,
        fileUrl: payload.fileUrl ?? null,
      });
      return formattedOutbound;
    }

    if (payload.conversationId) {
      const agentMessage = buildTaskExecuteAgentMessage(payload.message, scheduledAt);
      const handlingMode = await getConversationHandlingMode(
        payload.workspaceId,
        payload.conversationId,
      );
      const skipInference = handlingMode === "human";
      const result = await runAgentSession({
        workspaceId: payload.workspaceId,
        message: agentMessage,
        sessionId: payload.conversationId,
        agentConfigId: payload.agentConfigId,
        dryRun,
        skipInference,
      });
      if (!result) {
        console.error(`[${logScope}] runAgentSession returned null`);
        if (payload.taskId) {
          await recordTaskRun({
            workspaceId: payload.workspaceId,
            taskId: payload.taskId,
            status: "fail",
            errorMessage: "Failed to run agent session",
          });
        }
        return { ok: false, error: "Failed to run agent session" };
      }
      if (!dryRun && payload.taskId) {
        await recordTaskRun({
          workspaceId: payload.workspaceId,
          taskId: payload.taskId,
          status: "success",
        });
      }
      return { ok: true, mode: "agent" };
    }

    if (effectiveLeadId) {
      const outbound = await getFormattedOutbound();
      if (dryRun) {
        return { ok: true, mode: "manual_whatsapp" };
      }
      const manual = await sendScheduledTaskAsManualWhatsapp({
        workspaceId: payload.workspaceId,
        agentConfigId: payload.agentConfigId,
        leadId: effectiveLeadId,
        instruction: outbound.message,
        fileUrl: outbound.fileUrl,
        whatsappConnectionId: taskRow?.whatsapp_connection_id ?? null,
      });
      if (!manual.ok) {
        console.error(`[${logScope}] Manual WhatsApp send failed`, { error: manual.error });
        if (payload.taskId) {
          await recordTaskRun({
            workspaceId: payload.workspaceId,
            taskId: payload.taskId,
            status: "fail",
            errorMessage: manual.error,
          });
        }
        return { ok: false, error: manual.error ?? "manual_send_failed" };
      }
      if (payload.taskId) {
        await recordTaskRun({
          workspaceId: payload.workspaceId,
          taskId: payload.taskId,
          status: "success",
        });
      }
      return { ok: true, mode: "manual_whatsapp" };
    }

    const batchLimit = taskRow?.daily_contact_limit ?? null;
    if (
      payload.taskId &&
      taskRow &&
      !taskRow.lead_id &&
      !payload.leadId &&
      batchLimit != null &&
      batchLimit > 0
    ) {
      const outbound = await getFormattedOutbound();
      const batch = await runTaskOutreachBatch({
        workspaceId: payload.workspaceId,
        agentConfigId: payload.agentConfigId,
        messageBody: outbound.message,
        fileUrl: outbound.fileUrl,
        whatsappConnectionId: taskRow.whatsapp_connection_id,
        limit: batchLimit,
        dryRun,
      });
      if (dryRun) {
        return { ok: true, mode: "batch_outreach" };
      }
      if (!batch.ok) {
        console.error(`[${logScope}] Batch outreach failed`, { error: batch.error });
        if (payload.taskId) {
          await recordTaskRun({
            workspaceId: payload.workspaceId,
            taskId: payload.taskId,
            status: "fail",
            errorMessage: batch.error,
          });
        }
        return { ok: false, error: batch.error ?? "batch_outreach_failed" };
      }
      if (payload.taskId) {
        await recordTaskRun({
          workspaceId: payload.workspaceId,
          taskId: payload.taskId,
          status: "success",
        });
      }
      return { ok: true, mode: "batch_outreach" };
    }

    const workspaceAgentMessage = buildWorkspaceScheduledAgentMessage(payload.message, scheduledAt);
    const workspaceResult = await runAgentSession({
      workspaceId: payload.workspaceId,
      message: workspaceAgentMessage,
      agentConfigId: payload.agentConfigId,
      dryRun,
    });
    if (!workspaceResult) {
      console.error(`[${logScope}] runAgentSession returned null (workspace)`);
      if (payload.taskId) {
        await recordTaskRun({
          workspaceId: payload.workspaceId,
          taskId: payload.taskId,
          status: "fail",
          errorMessage: "Failed to run agent session",
        });
      }
      return { ok: false, error: "Failed to run agent session" };
    }
    if (!dryRun && payload.taskId) {
      await recordTaskRun({
        workspaceId: payload.workspaceId,
        taskId: payload.taskId,
        status: "success",
      });
    }
    return { ok: true, mode: "workspace_agent" };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[${logScope}] Unexpected error: ${message}`);
    if (payload.taskId) {
      await recordTaskRun({
        workspaceId: payload.workspaceId,
        taskId: payload.taskId,
        status: "fail",
        errorMessage: message,
      });
    }
    return { ok: false, error: message };
  }
}
