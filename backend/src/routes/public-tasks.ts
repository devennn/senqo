import { Hono } from "hono";
import { z } from "zod";
import { fromZonedTime } from "date-fns-tz";
import { apiHostGuardMiddleware } from "../middleware/api-host-guard.js";
import { apiKeyAuthMiddleware } from "../middleware/api-key-auth.js";
import type { ApiKeyAuthVariables } from "../middleware/api-key-auth.js";
import { findOrCreateLeadForContact } from "../repositories/leads.js";
import { createTask } from "../repositories/tasks.js";
import {
  findConnectionByPhoneNumber,
  findOrCreateContactByPhone,
  isWhatsappConnectionAuthorized,
} from "../repositories/whatsapp.js";
import { scheduleAgentTask } from "../services/job-scheduler.js";
import { toCronSchedule } from "../services/task-schedule.js";
import type { CreateScheduledTaskApiResponse } from "../types/api-public-tasks.js";

const app = new Hono<{ Variables: ApiKeyAuthVariables }>();

app.use("*", apiHostGuardMiddleware);
app.use("*", apiKeyAuthMiddleware);

const createScheduledTaskApiSchema = z.object({
  message: z.string().min(1),
  senderPhone: z.string().min(5),
  phoneNumber: z.string().min(5),
  fileUrl: z.string().url().optional(),
  scheduleType: z.literal("one_time"),
  scheduleAt: z.string().min(1),
  timezone: z.string().min(1),
});

function normalizePhone(input: string): string {
  const trimmed = input.trim();
  const digits = trimmed.replace(/\D/g, "");
  return digits;
}

function normalizePhoneCandidates(input: string): string[] {
  const normalized = normalizePhone(input);
  if (!normalized) {
    return [];
  }
  const digits = normalized.replace(/\D/g, "");
  return [...new Set([normalized, digits, `+${digits}`])];
}

function toUtcIsoFromScheduleAtLocal(
  scheduleAtLocal: string,
  timezone: string,
): string {
  const value = scheduleAtLocal.trim();
  const parsed = fromZonedTime(value, timezone);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("invalid_schedule");
  }
  return parsed.toISOString();
}

async function resolveSenderConnection(
  workspaceId: string,
  senderPhone: string,
): Promise<
  | { ok: true; agentConfigId: string }
  | {
      ok: false;
      response: CreateScheduledTaskApiResponse;
    }
> {
  const candidates = normalizePhoneCandidates(senderPhone);
  if (candidates.length === 0) {
    return {
      ok: false,
      response: { ok: false, error: "invalid_payload" },
    };
  }
  for (const candidate of candidates) {
    const senderConnection = await findConnectionByPhoneNumber(workspaceId, candidate);
    if (!senderConnection.id) {
      continue;
    }
    if (
      !isWhatsappConnectionAuthorized({
        status: senderConnection.status,
        last_state_instance: senderConnection.last_state_instance,
      })
    ) {
      return {
        ok: false,
        response: { ok: false, error: "sender_not_activated" },
      };
    }
    if (!senderConnection.agent_config_id) {
      return {
        ok: false,
        response: { ok: false, error: "sender_agent_not_attached" },
      };
    }
    return { ok: true, agentConfigId: senderConnection.agent_config_id };
  }
  return {
    ok: false,
    response: { ok: false, error: "sender_not_registered" },
  };
}

function isSafeExternalUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    if (url.protocol !== "https:") return false;

    const hostname = url.hostname;
    if (hostname === "localhost" || hostname === "127.0.0.1") return false;
    if (hostname.startsWith("10.")) return false;
    if (hostname.startsWith("192.168.")) return false;
    if (hostname.startsWith("172.")) {
      const secondOctet = parseInt(hostname.split(".")[1], 10);
      if (secondOctet >= 16 && secondOctet <= 31) return false;
    }
    if (hostname === "169.254.169.254") return false;
    if (hostname.endsWith(".internal")) return false;
    if (hostname.endsWith(".local")) return false;

    return true;
  } catch {
    return false;
  }
}

app.post("/", async (c) => {
  const workspaceId = c.get("workspaceId");
  const parsed = createScheduledTaskApiSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json(
      {
        ok: false,
        error: "invalid_payload",
        issues: parsed.error.flatten(),
      } satisfies CreateScheduledTaskApiResponse,
      400,
    );
  }

  if (parsed.data.fileUrl && !isSafeExternalUrl(parsed.data.fileUrl)) {
    return c.json(
      { ok: false, error: "invalid_file_url" } satisfies CreateScheduledTaskApiResponse,
      400,
    );
  }

  if (parsed.data.scheduleType !== "one_time") {
    return c.json(
      {
        ok: false,
        error: "unsupported_schedule_type",
      } satisfies CreateScheduledTaskApiResponse,
      422,
    );
  }

  const senderResolved = await resolveSenderConnection(
    workspaceId,
    parsed.data.senderPhone,
  );
  if (!senderResolved.ok) {
    return c.json(senderResolved.response, 422);
  }

  const recipientDigits = normalizePhone(parsed.data.phoneNumber);
  if (!recipientDigits) {
    return c.json(
      {
        ok: false,
        error: "invalid_payload",
      } satisfies CreateScheduledTaskApiResponse,
      400,
    );
  }

  const contact = await findOrCreateContactByPhone(
    workspaceId,
    recipientDigits,
    recipientDigits,
  );
  if (!contact.id) {
    return c.json(
      {
        ok: false,
        error: "contact_resolve_failed",
      } satisfies CreateScheduledTaskApiResponse,
      422,
    );
  }

  const leadRecord = await findOrCreateLeadForContact(workspaceId, contact.id);
  if (!leadRecord) {
    return c.json(
      {
        ok: false,
        error: "lead_resolve_failed",
      } satisfies CreateScheduledTaskApiResponse,
      422,
    );
  }

  let oneTimeAt: string | null = null;
  try {
    const schedule = toCronSchedule({
      scheduleType: "one_time",
      oneTimeAt: toUtcIsoFromScheduleAtLocal(
        parsed.data.scheduleAt,
        parsed.data.timezone,
      ),
    });
    oneTimeAt = schedule.oneTimeAt;
  } catch {
    return c.json(
      {
        ok: false,
        error: "invalid_schedule",
      } satisfies CreateScheduledTaskApiResponse,
      422,
    );
  }

  const taskId = crypto.randomUUID();
  let jobPayload: Record<string, unknown> = {};
  try {
    const scheduled = await scheduleAgentTask({
      workspaceId,
      agentConfigId: senderResolved.agentConfigId,
      prompt: parsed.data.message,
      fileUrl: parsed.data.fileUrl ?? null,
      cronExpression: null,
      oneTimeAt,
      taskId,
      conversationId: null,
      leadId: leadRecord.id,
      scheduledAt: oneTimeAt,
    });
    jobPayload = scheduled.payload;
  } catch {
    return c.json(
      {
        ok: false,
        error: "task_schedule_failed",
      } satisfies CreateScheduledTaskApiResponse,
      422,
    );
  }

  const created = await createTask({
    id: taskId,
    workspaceId,
    agentConfigId: senderResolved.agentConfigId,
    leadId: leadRecord.id,
    prompt: parsed.data.message,
    scheduleType: "one_time",
    cronExpression: null,
    oneTimeAt,
    fileUrl: parsed.data.fileUrl ?? null,
    timezone: parsed.data.timezone ?? "UTC",
    jobPayload,
    source: "api",
  });
  if (!created.ok) {
    return c.json(
      { ok: false, error: "internal_error" } satisfies CreateScheduledTaskApiResponse,
      500,
    );
  }

  return c.json(
    { ok: true, id: taskId } satisfies CreateScheduledTaskApiResponse,
    200,
  );
});

export default app;
