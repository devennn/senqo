import { tool } from "ai";
import { z } from "zod";
import type { AgentToolRuntimeContext } from "../tools/shared.js";
import { findOrCreateLeadForConversation } from "../../repositories/leads.js";
import { createTask } from "../../repositories/tasks.js";
import { getConversationWithContact } from "../../repositories/conversations.js";
import { resolveWhatsappConnectionIdForAgentTask } from "../../repositories/whatsapp.js";
import { scheduleAgentTask } from "../../services/job-scheduler.js";
import { taskScheduleSchema, toCronSchedule } from "../../services/task-schedule.js";

const createTaskToolInputSchema = z.object({
  prompt: z.string().min(1),
  fileUrl: z.url().optional(),
  scheduleType: taskScheduleSchema.shape.scheduleType,
  oneTimeAt: taskScheduleSchema.shape.oneTimeAt,
  attachCurrentConversationLead: z.boolean().default(true),
  whatsappConnectionId: z.string().uuid().optional(),
});

export function createTaskTool(context: AgentToolRuntimeContext) {
  return tool({
    description:
      "Create a one-time task for follow-ups/outreach. Can auto-link the current conversation lead. When the agent has multiple WhatsApp lines, pass whatsappConnectionId or the current conversation line is used.",
    inputSchema: createTaskToolInputSchema,
    execute: async (input) => {
      if (!context.agentConfigId) {
        return { ok: false, error: "No agent config id provided for task creation." };
      }

      const scheduleValidation = taskScheduleSchema.safeParse(input);
      if (!scheduleValidation.success) {
        return { ok: false, error: "Invalid schedule payload." };
      }

      let leadId: string | null = null;
      if (input.attachCurrentConversationLead) {
        const lead = await findOrCreateLeadForConversation(context.workspaceId, context.sessionId);
        leadId = lead?.id ?? null;
      }

      let preferredConnectionId = input.whatsappConnectionId?.trim() ?? "";
      if (!preferredConnectionId) {
        const conversation = await getConversationWithContact(
          context.workspaceId,
          context.sessionId,
        );
        preferredConnectionId = conversation?.whatsappConnection?.id?.trim() ?? "";
      }

      const connectionResolved = await resolveWhatsappConnectionIdForAgentTask(
        context.workspaceId,
        context.agentConfigId,
        preferredConnectionId || null,
      );
      if (!connectionResolved.ok) {
        return { ok: false, error: connectionResolved.error };
      }

      let cronExpression: string | null = null;
      let oneTimeAt: string | null = null;
      let timezone = "UTC";
      try {
        const schedule = toCronSchedule(scheduleValidation.data);
        cronExpression = schedule.cronExpression;
        oneTimeAt = schedule.oneTimeAt;
        timezone = schedule.timezone;
      } catch {
        return { ok: false, error: "Failed to convert schedule to cron payload." };
      }

      const taskId = crypto.randomUUID();
      let jobPayload: Record<string, unknown> = {};
      try {
        const scheduled = await scheduleAgentTask({
          workspaceId: context.workspaceId,
          agentConfigId: context.agentConfigId,
          prompt: input.prompt,
          fileUrl: input.fileUrl ?? null,
          cronExpression,
          oneTimeAt,
          taskId,
          conversationId: context.sessionId,
          leadId,
          scheduledAt: oneTimeAt ?? null,
        });
        jobPayload = scheduled.payload;
      } catch {
        return { ok: false, error: "Failed to schedule task in job queue." };
      }

      const created = await createTask({
        id: taskId,
        workspaceId: context.workspaceId,
        agentConfigId: context.agentConfigId,
        whatsappConnectionId: connectionResolved.connectionId,
        leadId,
        prompt: input.prompt,
        fileUrl: input.fileUrl ?? null,
        scheduleType: input.scheduleType,
        cronExpression,
        oneTimeAt,
        timezone,
        jobPayload,
        source: "ai",
      });

      if (!created.ok || !created.id) {
        return { ok: false, error: created.message || "Task creation failed." };
      }

      return {
        ok: true,
        taskId: created.id,
        cronExpression,
        oneTimeAt,
        timezone,
        leadId,
      };
    },
  });
}
