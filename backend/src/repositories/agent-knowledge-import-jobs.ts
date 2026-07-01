import { and, desc, eq, inArray, ne } from "drizzle-orm";
import { db } from "../db/index.js";
import { agentKnowledgeImportJobs } from "../db/schema/index.js";
import type {
  AgentKnowledgeImportJobFile,
  AgentKnowledgeImportJobRecord,
  AgentKnowledgeImportJobStatus,
  AgentKnowledgeImportJobSummary,
} from "../types/agent-knowledge-import-job.js";
import type {
  AgentKnowledgeImportDraft,
  AgentKnowledgeImportTarget,
  AgentKnowledgeImportWorkspaceRefs,
} from "../types/agent-knowledge-import.js";

const scope = "AgentKnowledgeImportJobsRepository";

const ACTIVE_STATUSES: AgentKnowledgeImportJobStatus[] = ["queued", "processing", "ready", "failed"];

function mapRow(row: typeof agentKnowledgeImportJobs.$inferSelect): AgentKnowledgeImportJobRecord {
  return {
    id: row.id,
    workspace_id: row.workspaceId,
    agent_id: row.agentId,
    profile_name: row.profileName,
    status: row.status as AgentKnowledgeImportJobStatus,
    targets: row.targets as AgentKnowledgeImportTarget[],
    focus_hint: row.focusHint,
    files: row.files as AgentKnowledgeImportJobFile[],
    draft: (row.draft as AgentKnowledgeImportDraft | null) ?? null,
    selection: row.selection ?? null,
    workspace_refs: row.workspaceRefs as AgentKnowledgeImportWorkspaceRefs,
    error_message: row.errorMessage,
    queue_job_id: row.queueJobId,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

export async function getAgentKnowledgeImportJobForWorker(
  jobId: string,
): Promise<AgentKnowledgeImportJobRecord | null> {
  try {
    const rows = await db
      .select()
      .from(agentKnowledgeImportJobs)
      .where(eq(agentKnowledgeImportJobs.id, jobId))
      .limit(1);

    if (rows.length === 0) {
      console.warn(`[${scope}/getForWorker] Failed query: job not found jobId=${jobId}`);
      return null;
    }

    console.info(`[${scope}/getForWorker] Success: jobId=${jobId}`);
    return mapRow(rows[0]);
  } catch (error) {
    console.error(`[${scope}/getForWorker] Unexpected error: ${String(error)}`);
    return null;
  }
}

export async function createAgentKnowledgeImportJob(input: {
  id: string;
  workspaceId: string;
  agentId: string;
  profileName: string;
  targets: AgentKnowledgeImportTarget[];
  focusHint: string;
  files: AgentKnowledgeImportJobFile[];
  queueJobId: string | null;
}): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  try {
    const rows = await db
      .insert(agentKnowledgeImportJobs)
      .values({
        id: input.id,
        workspaceId: input.workspaceId,
        agentId: input.agentId,
        profileName: input.profileName,
        status: "queued",
        targets: input.targets,
        focusHint: input.focusHint,
        files: input.files,
        queueJobId: input.queueJobId,
      })
      .returning({ id: agentKnowledgeImportJobs.id });

    console.info(`[${scope}/create] Success: agentId=${input.agentId} jobId=${rows[0].id}`);
    return { ok: true, id: rows[0].id };
  } catch (error) {
    console.error(`[${scope}/create] Unexpected error: ${String(error)}`);
    return { ok: false, message: "Could not create import job." };
  }
}

export async function getAgentKnowledgeImportJobById(
  workspaceId: string,
  agentId: string,
  jobId: string,
): Promise<AgentKnowledgeImportJobRecord | null> {
  try {
    const rows = await db
      .select()
      .from(agentKnowledgeImportJobs)
      .where(
        and(
          eq(agentKnowledgeImportJobs.workspaceId, workspaceId),
          eq(agentKnowledgeImportJobs.agentId, agentId),
          eq(agentKnowledgeImportJobs.id, jobId),
        ),
      )
      .limit(1);

    if (rows.length === 0) {
      console.warn(`[${scope}/getById] Failed query: job not found jobId=${jobId}`);
      return null;
    }

    console.info(`[${scope}/getById] Success: jobId=${jobId}`);
    return mapRow(rows[0]);
  } catch (error) {
    console.error(`[${scope}/getById] Unexpected error: ${String(error)}`);
    return null;
  }
}

export async function listActiveAgentKnowledgeImportJobs(
  workspaceId: string,
  agentId: string,
): Promise<AgentKnowledgeImportJobSummary[]> {
  try {
    const rows = await db
      .select()
      .from(agentKnowledgeImportJobs)
      .where(
        and(
          eq(agentKnowledgeImportJobs.workspaceId, workspaceId),
          eq(agentKnowledgeImportJobs.agentId, agentId),
          inArray(agentKnowledgeImportJobs.status, ACTIVE_STATUSES),
        ),
      )
      .orderBy(desc(agentKnowledgeImportJobs.updatedAt));

    console.info(`[${scope}/listActive] Success: agentId=${agentId} count=${rows.length}`);
    return rows.map((row) => ({
      id: row.id,
      status: row.status as AgentKnowledgeImportJobStatus,
      profile_name: row.profileName,
      file_count: (row.files as AgentKnowledgeImportJobFile[]).length,
      error_message: row.errorMessage,
      created_at: row.createdAt.toISOString(),
      updated_at: row.updatedAt.toISOString(),
    }));
  } catch (error) {
    console.error(`[${scope}/listActive] Unexpected error: ${String(error)}`);
    return [];
  }
}

export async function markAgentKnowledgeImportJobProcessing(
  jobId: string,
): Promise<boolean> {
  try {
    const rows = await db
      .update(agentKnowledgeImportJobs)
      .set({ status: "processing", updatedAt: new Date() })
      .where(and(eq(agentKnowledgeImportJobs.id, jobId), eq(agentKnowledgeImportJobs.status, "queued")))
      .returning({ id: agentKnowledgeImportJobs.id });

    if (rows.length === 0) {
      console.warn(`[${scope}/markProcessing] Failed query: job not queued jobId=${jobId}`);
      return false;
    }

    console.info(`[${scope}/markProcessing] Success: jobId=${jobId}`);
    return true;
  } catch (error) {
    console.error(`[${scope}/markProcessing] Unexpected error: ${String(error)}`);
    return false;
  }
}

export async function markAgentKnowledgeImportJobReady(input: {
  jobId: string;
  draft: AgentKnowledgeImportDraft;
  selection: unknown;
}): Promise<boolean> {
  try {
    const rows = await db
      .update(agentKnowledgeImportJobs)
      .set({
        status: "ready",
        draft: input.draft,
        selection: input.selection,
        errorMessage: null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(agentKnowledgeImportJobs.id, input.jobId),
          ne(agentKnowledgeImportJobs.status, "dismissed"),
        ),
      )
      .returning({ id: agentKnowledgeImportJobs.id });

    if (rows.length === 0) {
      console.warn(`[${scope}/markReady] Failed query: job not found jobId=${input.jobId}`);
      return false;
    }

    console.info(`[${scope}/markReady] Success: jobId=${input.jobId}`);
    return true;
  } catch (error) {
    console.error(`[${scope}/markReady] Unexpected error: ${String(error)}`);
    return false;
  }
}

export async function markAgentKnowledgeImportJobFailed(
  jobId: string,
  message: string,
): Promise<boolean> {
  try {
    await db
      .update(agentKnowledgeImportJobs)
      .set({
        status: "failed",
        errorMessage: message,
        updatedAt: new Date(),
      })
      .where(eq(agentKnowledgeImportJobs.id, jobId));

    console.info(`[${scope}/markFailed] Success: jobId=${jobId}`);
    return true;
  } catch (error) {
    console.error(`[${scope}/markFailed] Unexpected error: ${String(error)}`);
    return false;
  }
}

export async function updateAgentKnowledgeImportJobState(input: {
  workspaceId: string;
  agentId: string;
  jobId: string;
  draft?: AgentKnowledgeImportDraft;
  selection?: unknown;
  workspaceRefs?: AgentKnowledgeImportWorkspaceRefs;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const patch: Partial<typeof agentKnowledgeImportJobs.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (input.draft !== undefined) patch.draft = input.draft;
    if (input.selection !== undefined) patch.selection = input.selection;
    if (input.workspaceRefs !== undefined) patch.workspaceRefs = input.workspaceRefs;

    const rows = await db
      .update(agentKnowledgeImportJobs)
      .set(patch)
      .where(
        and(
          eq(agentKnowledgeImportJobs.workspaceId, input.workspaceId),
          eq(agentKnowledgeImportJobs.agentId, input.agentId),
          eq(agentKnowledgeImportJobs.id, input.jobId),
          ne(agentKnowledgeImportJobs.status, "dismissed"),
        ),
      )
      .returning({ id: agentKnowledgeImportJobs.id });

    if (rows.length === 0) {
      console.warn(`[${scope}/updateState] Failed query: job not found jobId=${input.jobId}`);
      return { ok: false, message: "Import job not found." };
    }

    console.info(`[${scope}/updateState] Success: jobId=${input.jobId}`);
    return { ok: true };
  } catch (error) {
    console.error(`[${scope}/updateState] Unexpected error: ${String(error)}`);
    return { ok: false, message: "Could not save import progress." };
  }
}

export async function dismissAgentKnowledgeImportJob(
  workspaceId: string,
  agentId: string,
  jobId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const rows = await db
      .update(agentKnowledgeImportJobs)
      .set({ status: "dismissed", updatedAt: new Date() })
      .where(
        and(
          eq(agentKnowledgeImportJobs.workspaceId, workspaceId),
          eq(agentKnowledgeImportJobs.agentId, agentId),
          eq(agentKnowledgeImportJobs.id, jobId),
        ),
      )
      .returning({ id: agentKnowledgeImportJobs.id });

    if (rows.length === 0) {
      console.warn(`[${scope}/dismiss] Failed query: job not found jobId=${jobId}`);
      return { ok: false, message: "Import job not found." };
    }

    console.info(`[${scope}/dismiss] Success: jobId=${jobId}`);
    return { ok: true };
  } catch (error) {
    console.error(`[${scope}/dismiss] Unexpected error: ${String(error)}`);
    return { ok: false, message: "Could not dismiss import job." };
  }
}
