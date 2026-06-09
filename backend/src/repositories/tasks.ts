import { eq, and, ne, isNull, isNotNull, ilike, or, inArray, desc, asc, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import {
  tasks,
  taskRuns,
  agentConfigs,
  leads,
  contacts,
  whatsappConnections,
} from "../db/schema/index.js";
import { isWhatsappConnectionAuthorized } from "./whatsapp.js";
import { listPageOffset } from "../lib/pagination.js";
import type {
  CreateTaskInput,
  PaginatedResult,
  RecordTaskRunInput,
  SchedulableAgentRecord,
  TaskListItem,
  TaskRecord,
} from "../types/repositories.js";

const scope = "TasksRepository";

const MAX_TASK_RUN_ERROR_MESSAGE_LENGTH = 4000;

function toIlikePattern(term: string): string {
  const escaped = term.replace(/[%_\\]/g, (char) => `\\${char}`);
  return `%${escaped}%`;
}

function normalizeLeadContactRow(
  contactData: {
    firstName: string | null;
    lastName: string | null;
    phone: string | null;
  } | null,
): TaskListItem["lead_contact"] | null {
  if (!contactData?.phone) {
    return null;
  }
  return {
    firstName: String(contactData.firstName ?? "").trim(),
    lastName: String(contactData.lastName ?? "").trim(),
    phone: String(contactData.phone).trim(),
  };
}

function mapSchedulableAgentRows(
  rows: { id: string; profileName: string }[],
): SchedulableAgentRecord[] {
  const seen = new Set<string>();
  const agents: SchedulableAgentRecord[] = [];
  for (const row of rows) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    agents.push({ id: row.id, profile_name: row.profileName });
  }
  return agents;
}

export async function listSchedulableAgents(
  workspaceId: string,
): Promise<SchedulableAgentRecord[]> {
  try {
    const attachedAgentRows = await db
      .select({
        id: agentConfigs.id,
        profileName: agentConfigs.profileName,
      })
      .from(agentConfigs)
      .innerJoin(
        whatsappConnections,
        and(
          eq(whatsappConnections.agentConfigId, agentConfigs.id),
          eq(whatsappConnections.workspaceId, workspaceId),
        ),
      )
      .where(
        and(
          eq(agentConfigs.workspaceId, workspaceId),
          isNull(agentConfigs.archivedAt),
        ),
      )
      .orderBy(desc(agentConfigs.updatedAt));

    if (attachedAgentRows.length > 0) {
      console.info(`[${scope}/listSchedulableAgents] Success: userId=${workspaceId}`);
      return mapSchedulableAgentRows(attachedAgentRows);
    }

    const connectionRows = await db
      .select({
        status: whatsappConnections.status,
        lastStateInstance: whatsappConnections.lastStateInstance,
      })
      .from(whatsappConnections)
      .where(eq(whatsappConnections.workspaceId, workspaceId));

    const hasAuthorizedConnection = connectionRows.some((row) =>
      isWhatsappConnectionAuthorized({
        status: row.status,
        lastStateInstance: row.lastStateInstance,
      }),
    );

    if (!hasAuthorizedConnection) {
      console.info(`[${scope}/listSchedulableAgents] Success: userId=${workspaceId}`);
      return [];
    }

    const workspaceAgentRows = await db
      .select({
        id: agentConfigs.id,
        profileName: agentConfigs.profileName,
      })
      .from(agentConfigs)
      .where(
        and(
          eq(agentConfigs.workspaceId, workspaceId),
          isNull(agentConfigs.archivedAt),
        ),
      )
      .orderBy(desc(agentConfigs.updatedAt));

    console.info(`[${scope}/listSchedulableAgents] Success: userId=${workspaceId}`);
    return mapSchedulableAgentRows(workspaceAgentRows);
  } catch (error) {
    console.error(
      `[${scope}/listSchedulableAgents] Unexpected error: ${String(error)}`,
    );
    return [];
  }
}

export async function createTask(
  input: CreateTaskInput,
): Promise<{ ok: boolean; message: string; id: string | null }> {
  try {
    const inserted = await db
      .insert(tasks)
      .values({
        id: input.id,
        workspaceId: input.workspaceId,
        agentConfigId: input.agentConfigId,
        leadId: input.leadId ?? null,
        prompt: input.prompt,
        fileUrl: input.fileUrl ?? null,
        scheduleType: input.scheduleType,
        cronExpression: input.cronExpression ?? null,
        oneTimeAt: input.oneTimeAt ? new Date(input.oneTimeAt) : null,
        timezone: input.timezone ?? "UTC",
        status: "active" as const,
        jobPayload: input.jobPayload,
        source: input.source ?? "user",
        dailyContactLimit: input.dailyContactLimit ?? null,
      })
      .returning({ id: tasks.id });

    const row = inserted[0];
    console.info(`[${scope}/createTask] Success: userId=${input.workspaceId}`);
    return { ok: true, message: "Task created", id: String(row?.id ?? "") };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[${scope}/createTask] Failed query: ${message}`);
    return { ok: false, message, id: null };
  }
}

export async function recordTaskRun(input: RecordTaskRunInput): Promise<boolean> {
  const now = new Date();
  const errorMessage =
    input.errorMessage && input.errorMessage.length > MAX_TASK_RUN_ERROR_MESSAGE_LENGTH
      ? `${input.errorMessage.slice(0, MAX_TASK_RUN_ERROR_MESSAGE_LENGTH)}\u2026`
      : (input.errorMessage ?? null);

  try {
    await db.insert(taskRuns).values({
      workspaceId: input.workspaceId,
      taskId: input.taskId,
      status: input.status,
      startedAt: now,
      finishedAt: now,
      errorMessage,
    });

    console.info(
      `[${scope}/recordTaskRun] Success: userId=${input.workspaceId} taskId=${input.taskId} status=${input.status}`,
    );
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[${scope}/recordTaskRun] Failed query: ${message}`);
    return false;
  }
}

export async function getTaskById(
  workspaceId: string,
  taskId: string,
): Promise<
  Pick<
    TaskRecord,
    | "id"
    | "lead_id"
    | "prompt"
    | "agent_config_id"
    | "one_time_at"
    | "daily_contact_limit"
    | "source"
    | "schedule_type"
    | "status"
    | "job_payload"
  > | null
> {
  try {
    const rows = await db
      .select({
        id: tasks.id,
        leadId: tasks.leadId,
        prompt: tasks.prompt,
        agentConfigId: tasks.agentConfigId,
        oneTimeAt: tasks.oneTimeAt,
        dailyContactLimit: tasks.dailyContactLimit,
        source: tasks.source,
        scheduleType: tasks.scheduleType,
        status: tasks.status,
        jobPayload: tasks.jobPayload,
      })
      .from(tasks)
      .where(and(eq(tasks.workspaceId, workspaceId), eq(tasks.id, taskId)))
      .limit(1);

    const data = rows[0] ?? null;

    if (!data) {
      console.error(`[${scope}/getTaskById] Failed query: task not found`);
      return null;
    }

    console.info(`[${scope}/getTaskById] Success: userId=${workspaceId}`);
    return {
      id: data.id,
      lead_id: data.leadId,
      prompt: data.prompt,
      agent_config_id: data.agentConfigId,
      one_time_at: data.oneTimeAt as unknown as string | null,
      daily_contact_limit: data.dailyContactLimit,
      source: data.source as TaskRecord["source"],
      schedule_type: data.scheduleType as TaskRecord["schedule_type"],
      status: data.status as TaskRecord["status"],
      job_payload: (data.jobPayload ?? {}) as Record<string, unknown>,
    };
  } catch (error) {
    console.error(`[${scope}/getTaskById] Unexpected error: ${String(error)}`);
    return null;
  }
}

export type ListTasksPageOptions = {
  page: number;
  pageSize: number;
  search?: string;
};

type TaskJoinRow = {
  id: string;
  prompt: string;
  fileUrl: string | null;
  scheduleType: string;
  cronExpression: string | null;
  oneTimeAt: Date | null;
  timezone: string;
  source: string;
  createdAt: Date;
  leadId: string | null;
  dailyContactLimit: number | null;
  status: string;
  agentId: string;
  agentProfileName: string;
};

export async function listTasksPage(
  workspaceId: string,
  options: ListTasksPageOptions,
): Promise<PaginatedResult<TaskListItem>> {
  const { page, pageSize } = options;
  const offset = listPageOffset(page, pageSize);
  const search = options.search?.trim() ?? "";

  try {
    const hasSearch = search.length > 0;
    const searchPattern = hasSearch ? toIlikePattern(search) : "";

    const baseConditions = [
      eq(tasks.workspaceId, workspaceId),
      eq(tasks.scheduleType, "one_time"),
    ];

    let count: number;
    let taskRows: TaskJoinRow[];

    if (hasSearch) {
      const searchConditions = [
        ...baseConditions,
        or(
          ilike(tasks.prompt, searchPattern),
          ilike(agentConfigs.profileName, searchPattern),
        ),
      ];

      const countResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(tasks)
        .innerJoin(agentConfigs, eq(tasks.agentConfigId, agentConfigs.id))
        .where(and(...searchConditions));

      count = countResult[0]?.count ?? 0;

      const rows = await db
        .select({
          id: tasks.id,
          prompt: tasks.prompt,
          fileUrl: tasks.fileUrl,
          scheduleType: tasks.scheduleType,
          cronExpression: tasks.cronExpression,
          oneTimeAt: tasks.oneTimeAt,
          timezone: tasks.timezone,
          source: tasks.source,
          createdAt: tasks.createdAt,
          leadId: tasks.leadId,
          dailyContactLimit: tasks.dailyContactLimit,
          status: tasks.status,
          agentId: agentConfigs.id,
          agentProfileName: agentConfigs.profileName,
        })
        .from(tasks)
        .innerJoin(agentConfigs, eq(tasks.agentConfigId, agentConfigs.id))
        .where(and(...searchConditions))
        .orderBy(desc(tasks.createdAt))
        .limit(pageSize)
        .offset(offset);

      taskRows = rows as unknown as TaskJoinRow[];
    } else {
      const countResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(tasks)
        .where(and(...baseConditions));

      count = countResult[0]?.count ?? 0;

      const rows = await db
        .select({
          id: tasks.id,
          prompt: tasks.prompt,
          fileUrl: tasks.fileUrl,
          scheduleType: tasks.scheduleType,
          cronExpression: tasks.cronExpression,
          oneTimeAt: tasks.oneTimeAt,
          timezone: tasks.timezone,
          source: tasks.source,
          createdAt: tasks.createdAt,
          leadId: tasks.leadId,
          dailyContactLimit: tasks.dailyContactLimit,
          status: tasks.status,
          agentId: agentConfigs.id,
          agentProfileName: agentConfigs.profileName,
        })
        .from(tasks)
        .leftJoin(agentConfigs, eq(tasks.agentConfigId, agentConfigs.id))
        .where(and(...baseConditions))
        .orderBy(desc(tasks.createdAt))
        .limit(pageSize)
        .offset(offset);

      taskRows = rows as unknown as TaskJoinRow[];
    }

    if (taskRows.length === 0) {
      console.info(`[${scope}/listTasksPage] Success: userId=${workspaceId}`);
      return { items: [], total: count, page, pageSize };
    }

    const leadIds = [
      ...new Set(taskRows.map((t) => t.leadId).filter((lid): lid is string => Boolean(lid))),
    ];
    const leadContactByLeadId = new Map<string, TaskListItem["lead_contact"]>();

    if (leadIds.length > 0) {
      const leadRows = await db
        .select({
          id: leads.id,
          firstName: contacts.firstName,
          lastName: contacts.lastName,
          phone: contacts.phone,
        })
        .from(leads)
        .leftJoin(contacts, eq(leads.contactId, contacts.id))
        .where(and(eq(leads.workspaceId, workspaceId), inArray(leads.id, leadIds)));

      for (const row of leadRows) {
        leadContactByLeadId.set(
          String(row.id),
          normalizeLeadContactRow({
            firstName: row.firstName,
            lastName: row.lastName,
            phone: row.phone,
          }),
        );
      }
    }

    const taskIdList = taskRows.map((t) => t.id);
    const lastRunStatusByTaskId = new Map<string, "success" | "fail">();

    try {
      const runRows = await db
        .select({
          taskId: taskRuns.taskId,
          status: taskRuns.status,
          createdAt: taskRuns.createdAt,
        })
        .from(taskRuns)
        .where(
          and(
            eq(taskRuns.workspaceId, workspaceId),
            inArray(taskRuns.taskId, taskIdList),
          ),
        )
        .orderBy(desc(taskRuns.createdAt));

      for (const row of runRows) {
        if (!lastRunStatusByTaskId.has(row.taskId)) {
          lastRunStatusByTaskId.set(row.taskId, row.status as "success" | "fail");
        }
      }
    } catch (runError) {
      console.error(`[${scope}/listTasksPage] Failed query: ${String(runError)}`);
    }

    const items: TaskListItem[] = [];
    for (const task of taskRows) {
      if (!task.agentId) continue;

      const lastRunStatus = lastRunStatusByTaskId.get(task.id) ?? null;

      items.push({
        id: task.id,
        prompt: task.prompt,
        file_url: task.fileUrl,
        schedule_type: task.scheduleType as TaskListItem["schedule_type"],
        cron_expression: task.cronExpression,
        one_time_at: task.oneTimeAt as unknown as string | null,
        timezone: task.timezone,
        source: task.source as TaskListItem["source"],
        created_at: task.createdAt as unknown as string,
        lead_id: task.leadId,
        lead_contact: task.leadId ? (leadContactByLeadId.get(task.leadId) ?? null) : null,
        daily_contact_limit: task.dailyContactLimit,
        status: task.status as TaskListItem["status"],
        agent: {
          id: task.agentId,
          profile_name: task.agentProfileName,
        },
        last_run_status: lastRunStatus,
      });
    }

    console.info(`[${scope}/listTasksPage] Success: userId=${workspaceId}`);
    return {
      items,
      total: count,
      page,
      pageSize,
    };
  } catch (error) {
    console.error(`[${scope}/listTasksPage] Unexpected error: ${String(error)}`);
    return { items: [], total: 0, page, pageSize };
  }
}

export async function cancelTaskById(workspaceId: string, taskId: string): Promise<boolean> {
  try {
    await db
      .update(tasks)
      .set({ status: "cancelled" })
      .where(
        and(
          eq(tasks.workspaceId, workspaceId),
          eq(tasks.id, taskId),
          ne(tasks.status, "cancelled"),
        ),
      );

    console.info(`[${scope}/cancelTaskById] Success: userId=${workspaceId} taskId=${taskId}`);
    return true;
  } catch (error) {
    console.error(`[${scope}/cancelTaskById] Unexpected error: ${String(error)}`);
    return false;
  }
}