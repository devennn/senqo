import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { agentConfigs, evalCases, evalRuns, workspaceHandoffTopicEntries } from "../db/schema/index.js";
import { listPageOffset } from "../lib/pagination.js";
import type {
  CreateEvalCaseFromDraftInput,
  CreateEvalRunInput,
  CreateManualEvalCaseInput,
  EvalCaseRecord,
  EvalCaseStatus,
  EvalExpectedAction,
  EvalKnowledgeRef,
  EvalRunRecord,
  EvalRunStatus,
  EvalSource,
  EvalTurn,
  EvalTurnMedia,
  EvalTurnRole,
  UpdateEvalCaseInput,
} from "../types/evals.js";

const scope = "EvalsRepository";

function asIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : String(value);
}

function parseSource(raw: string): EvalSource {
  if (raw === "conversation") return "conversation";
  if (raw === "template") return "template";
  if (raw === "context") return "context";
  if (raw === "handoff") return "handoff";
  return "manual";
}

function parseExpectedAction(raw: string | null | undefined): EvalExpectedAction {
  return raw === "handoff" ? "handoff" : "reply";
}

function parseStatus(raw: string): EvalCaseStatus {
  return raw === "draft" ? "draft" : "ready";
}

function parseTurnRole(raw: unknown): EvalTurnRole | null {
  return raw === "user" || raw === "assistant" ? raw : null;
}

function parseMedia(raw: unknown): EvalTurnMedia | null {
  if (!raw || typeof raw !== "object") return null;
  const media = raw as Record<string, unknown>;
  return {
    path: typeof media.path === "string" ? media.path : undefined,
    storageBucket:
      typeof media.storageBucket === "string" ? media.storageBucket : undefined,
    fileName: typeof media.fileName === "string" ? media.fileName : undefined,
    mimeType: typeof media.mimeType === "string" ? media.mimeType : undefined,
    caption: typeof media.caption === "string" ? media.caption : undefined,
    sourceUrl: typeof media.sourceUrl === "string" ? media.sourceUrl : undefined,
    signedUrl: typeof media.signedUrl === "string" ? media.signedUrl : undefined,
    fileSizeBytes:
      typeof media.fileSizeBytes === "number" ? media.fileSizeBytes : undefined,
  };
}

function parseSources(raw: unknown): EvalKnowledgeRef[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const sources: EvalKnowledgeRef[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const ref = item as Record<string, unknown>;
    const kind = ref.kind;
    const label = typeof ref.label === "string" ? ref.label.trim() : "";
    if (
      (kind === "context" ||
        kind === "template" ||
        kind === "skill" ||
        kind === "handoff") &&
      label
    ) {
      sources.push({ kind, label });
    }
  }
  return sources.length > 0 ? sources : undefined;
}

export function parseEvalTurns(raw: unknown): EvalTurn[] {
  if (!Array.isArray(raw)) return [];
  const turns: EvalTurn[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const role = parseTurnRole(row.role);
    if (!role) continue;
    const content = typeof row.content === "string" ? row.content : "";
    const turn: EvalTurn = { role, content };
    const media = parseMedia(row.media);
    if (media) turn.media = media;
    if (typeof row.whyReply === "string") turn.whyReply = row.whyReply;
    else if (row.whyReply === null) turn.whyReply = null;
    const sources = parseSources(row.sources);
    if (sources) turn.sources = sources;
    turns.push(turn);
  }
  return turns;
}

function parseRunStatus(raw: string): EvalRunStatus {
  if (raw === "passed" || raw === "error") return raw;
  return "failed";
}

function toRunRecord(row: {
  id: string;
  status: string;
  actualReply: string;
  answerAnalysis: string | null;
  reasoningForOperators: string | null;
  handoffCalled: boolean;
  handoffTopicEntryId: string | null;
  handoffTopicLabel: string | null;
  errorMessage: string | null;
  subjectSessionId: string | null;
  ranAt: Date;
}): EvalRunRecord {
  return {
    id: row.id,
    status: parseRunStatus(row.status),
    actualReply: row.actualReply,
    answerAnalysis: row.answerAnalysis,
    reasoningForOperators: row.reasoningForOperators,
    handoffCalled: Boolean(row.handoffCalled),
    handoffTopicEntryId: row.handoffTopicEntryId,
    handoffTopicLabel: row.handoffTopicLabel,
    errorMessage: row.errorMessage,
    subjectSessionId: row.subjectSessionId,
    ranAt: asIso(row.ranAt),
  };
}

function toCaseRecord(
  row: {
    id: string;
    workspaceId: string;
    agentConfigId: string;
    title: string;
    source: string;
    status: string;
    expectedReply: string;
    expectedAction: string | null;
    expectedTopicEntryId: string | null;
    expectedTopicLabel: string | null;
    expectedTopicDescription: string | null;
    answerAnalysis: string | null;
    answerCorrect: boolean | null;
    sourceConversationId: string | null;
    turns: unknown;
    createdAt: Date;
    updatedAt: Date;
    agentName: string | null;
  },
  runs: EvalRunRecord[],
): EvalCaseRecord {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    agentId: row.agentConfigId,
    agentName: row.agentName?.trim() || "Agent",
    title: row.title,
    source: parseSource(row.source),
    status: parseStatus(row.status),
    turns: parseEvalTurns(row.turns),
    expectedReply: row.expectedReply,
    expectedAction: parseExpectedAction(row.expectedAction),
    expectedTopicEntryId: row.expectedTopicEntryId,
    expectedTopicLabel: row.expectedTopicLabel,
    expectedTopicDescription: row.expectedTopicDescription,
    answerAnalysis: row.answerAnalysis,
    answerCorrect: row.answerCorrect,
    sourceConversationId: row.sourceConversationId,
    runs,
    createdAt: asIso(row.createdAt),
    updatedAt: asIso(row.updatedAt),
  };
}

async function listRunsForCases(
  workspaceId: string,
  caseIds: string[],
): Promise<Map<string, EvalRunRecord[]>> {
  const map = new Map<string, EvalRunRecord[]>();
  if (caseIds.length === 0) return map;
  try {
    const rows = await db
      .select({
        id: evalRuns.id,
        evalCaseId: evalRuns.evalCaseId,
        status: evalRuns.status,
        actualReply: evalRuns.actualReply,
        answerAnalysis: evalRuns.answerAnalysis,
        reasoningForOperators: evalRuns.reasoningForOperators,
        handoffCalled: evalRuns.handoffCalled,
        handoffTopicEntryId: evalRuns.handoffTopicEntryId,
        handoffTopicLabel: workspaceHandoffTopicEntries.title,
        errorMessage: evalRuns.errorMessage,
        subjectSessionId: evalRuns.subjectSessionId,
        ranAt: evalRuns.ranAt,
      })
      .from(evalRuns)
      .leftJoin(
        workspaceHandoffTopicEntries,
        eq(evalRuns.handoffTopicEntryId, workspaceHandoffTopicEntries.id),
      )
      .where(
        and(
          eq(evalRuns.workspaceId, workspaceId),
          inArray(evalRuns.evalCaseId, caseIds),
        ),
      )
      .orderBy(desc(evalRuns.ranAt));

    for (const row of rows) {
      const list = map.get(row.evalCaseId) ?? [];
      list.push(toRunRecord(row));
      map.set(row.evalCaseId, list);
    }
    return map;
  } catch (error) {
    console.error(`[${scope}/listRunsForCases] Unexpected error: ${String(error)}`);
    return map;
  }
}

export async function listEvalCasesPage(input: {
  workspaceId: string;
  agentConfigId: string;
  page: number;
  pageSize: number;
}): Promise<{ items: EvalCaseRecord[]; total: number }> {
  const { workspaceId, agentConfigId, page, pageSize } = input;
  const offset = listPageOffset(page, pageSize);
  try {
    const where = and(
      eq(evalCases.workspaceId, workspaceId),
      eq(evalCases.agentConfigId, agentConfigId),
    );

    const [countRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(evalCases)
      .where(where);

    const rows = await db
      .select({
        id: evalCases.id,
        workspaceId: evalCases.workspaceId,
        agentConfigId: evalCases.agentConfigId,
        title: evalCases.title,
        source: evalCases.source,
        status: evalCases.status,
        expectedReply: evalCases.expectedReply,
        expectedAction: evalCases.expectedAction,
        expectedTopicEntryId: evalCases.expectedTopicEntryId,
        expectedTopicLabel: workspaceHandoffTopicEntries.title,
        expectedTopicDescription: workspaceHandoffTopicEntries.description,
        answerAnalysis: evalCases.answerAnalysis,
        answerCorrect: evalCases.answerCorrect,
        sourceConversationId: evalCases.sourceConversationId,
        turns: evalCases.turns,
        createdAt: evalCases.createdAt,
        updatedAt: evalCases.updatedAt,
        agentName: agentConfigs.profileName,
      })
      .from(evalCases)
      .leftJoin(agentConfigs, eq(evalCases.agentConfigId, agentConfigs.id))
      .leftJoin(
        workspaceHandoffTopicEntries,
        eq(evalCases.expectedTopicEntryId, workspaceHandoffTopicEntries.id),
      )
      .where(where)
      .orderBy(desc(evalCases.createdAt))
      .limit(pageSize)
      .offset(offset);

    const runsByCase = await listRunsForCases(
      workspaceId,
      rows.map((row) => row.id),
    );

    const items = rows.map((row) =>
      toCaseRecord(row, runsByCase.get(row.id) ?? []),
    );
    console.info(
      `[${scope}/listEvalCasesPage] Success: userId=${workspaceId} agentId=${agentConfigId} total=${countRow?.count ?? 0}`,
    );
    return { items, total: countRow?.count ?? 0 };
  } catch (error) {
    console.error(`[${scope}/listEvalCasesPage] Unexpected error: ${String(error)}`);
    return { items: [], total: 0 };
  }
}

export async function getEvalCaseById(
  workspaceId: string,
  evalCaseId: string,
): Promise<EvalCaseRecord | null> {
  try {
    const rows = await db
      .select({
        id: evalCases.id,
        workspaceId: evalCases.workspaceId,
        agentConfigId: evalCases.agentConfigId,
        title: evalCases.title,
        source: evalCases.source,
        status: evalCases.status,
        expectedReply: evalCases.expectedReply,
        expectedAction: evalCases.expectedAction,
        expectedTopicEntryId: evalCases.expectedTopicEntryId,
        expectedTopicLabel: workspaceHandoffTopicEntries.title,
        expectedTopicDescription: workspaceHandoffTopicEntries.description,
        answerAnalysis: evalCases.answerAnalysis,
        answerCorrect: evalCases.answerCorrect,
        sourceConversationId: evalCases.sourceConversationId,
        turns: evalCases.turns,
        createdAt: evalCases.createdAt,
        updatedAt: evalCases.updatedAt,
        agentName: agentConfigs.profileName,
      })
      .from(evalCases)
      .leftJoin(agentConfigs, eq(evalCases.agentConfigId, agentConfigs.id))
      .leftJoin(
        workspaceHandoffTopicEntries,
        eq(evalCases.expectedTopicEntryId, workspaceHandoffTopicEntries.id),
      )
      .where(
        and(
          eq(evalCases.workspaceId, workspaceId),
          eq(evalCases.id, evalCaseId),
        ),
      )
      .limit(1);

    const row = rows[0];
    if (!row) {
      console.info(
        `[${scope}/getEvalCaseById] Success: no row userId=${workspaceId} id=${evalCaseId}`,
      );
      return null;
    }

    const runsByCase = await listRunsForCases(workspaceId, [row.id]);
    console.info(`[${scope}/getEvalCaseById] Success: userId=${workspaceId} id=${evalCaseId}`);
    return toCaseRecord(row, runsByCase.get(row.id) ?? []);
  } catch (error) {
    console.error(`[${scope}/getEvalCaseById] Unexpected error: ${String(error)}`);
    return null;
  }
}

export async function createManualEvalCase(
  input: CreateManualEvalCaseInput,
): Promise<{ ok: true; id: string } | { ok: false }> {
  try {
    const inserted = await db
      .insert(evalCases)
      .values({
        workspaceId: input.workspaceId,
        agentConfigId: input.agentConfigId,
        title: input.title.trim(),
        source: "manual",
        status: "ready",
        expectedReply: input.expectedReply.trim(),
        answerAnalysis: null,
        answerCorrect: null,
        expectedAction: "reply",
        expectedTopicEntryId: null,
        sourceConversationId: null,
        turns: [{ role: "user", content: input.userMessage.trim() }],
      })
      .returning({ id: evalCases.id });

    const id = inserted[0]?.id;
    if (!id) {
      console.error(`[${scope}/createManualEvalCase] Failed query: missing id`);
      return { ok: false };
    }
    console.info(
      `[${scope}/createManualEvalCase] Success: userId=${input.workspaceId} id=${id}`,
    );
    return { ok: true, id };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[${scope}/createManualEvalCase] Failed query: ${message}`);
    return { ok: false };
  }
}

export async function createEvalCaseFromDraft(
  input: CreateEvalCaseFromDraftInput,
): Promise<{ ok: true; id: string } | { ok: false }> {
  try {
    const inserted = await db
      .insert(evalCases)
      .values({
        workspaceId: input.workspaceId,
        agentConfigId: input.agentConfigId,
        title: input.title.trim(),
        source: input.source,
        status: input.status,
        expectedReply: input.expectedReply.trim(),
        expectedAction: input.expectedAction ?? "reply",
        expectedTopicEntryId: input.expectedTopicEntryId ?? null,
        answerAnalysis: input.answerAnalysis,
        answerCorrect: input.answerCorrect,
        sourceConversationId: input.sourceConversationId,
        turns: input.turns,
      })
      .returning({ id: evalCases.id });

    const id = inserted[0]?.id;
    if (!id) {
      console.error(`[${scope}/createEvalCaseFromDraft] Failed query: missing id`);
      return { ok: false };
    }
    console.info(
      `[${scope}/createEvalCaseFromDraft] Success: userId=${input.workspaceId} id=${id}`,
    );
    return { ok: true, id };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[${scope}/createEvalCaseFromDraft] Failed query: ${message}`);
    return { ok: false };
  }
}

export async function updateEvalCase(
  workspaceId: string,
  evalCaseId: string,
  patch: UpdateEvalCaseInput,
): Promise<{ ok: boolean }> {
  try {
    const values: Record<string, unknown> = {
      updatedAt: new Date(),
    };
    if (patch.title !== undefined) values.title = patch.title.trim();
    if (patch.status !== undefined) values.status = patch.status;
    if (patch.turns !== undefined) values.turns = patch.turns;
    if (patch.expectedReply !== undefined) {
      values.expectedReply = patch.expectedReply.trim();
    }
    if (patch.expectedAction !== undefined) {
      values.expectedAction = patch.expectedAction;
    }
    if (patch.expectedTopicEntryId !== undefined) {
      values.expectedTopicEntryId = patch.expectedTopicEntryId;
    }
    if (patch.answerAnalysis !== undefined) {
      values.answerAnalysis = patch.answerAnalysis;
    }
    if (patch.answerCorrect !== undefined) {
      values.answerCorrect = patch.answerCorrect;
    }

    const updated = await db
      .update(evalCases)
      .set(values)
      .where(
        and(
          eq(evalCases.workspaceId, workspaceId),
          eq(evalCases.id, evalCaseId),
        ),
      )
      .returning({ id: evalCases.id });

    if (!updated[0]) {
      console.info(
        `[${scope}/updateEvalCase] Failed query: not found userId=${workspaceId} id=${evalCaseId}`,
      );
      return { ok: false };
    }
    console.info(`[${scope}/updateEvalCase] Success: userId=${workspaceId} id=${evalCaseId}`);
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[${scope}/updateEvalCase] Failed query: ${message}`);
    return { ok: false };
  }
}

export async function deleteEvalCase(
  workspaceId: string,
  evalCaseId: string,
): Promise<{ ok: boolean }> {
  try {
    const deleted = await db
      .delete(evalCases)
      .where(
        and(
          eq(evalCases.workspaceId, workspaceId),
          eq(evalCases.id, evalCaseId),
        ),
      )
      .returning({ id: evalCases.id });

    if (!deleted[0]) {
      console.info(
        `[${scope}/deleteEvalCase] Failed query: not found userId=${workspaceId} id=${evalCaseId}`,
      );
      return { ok: false };
    }
    console.info(`[${scope}/deleteEvalCase] Success: userId=${workspaceId} id=${evalCaseId}`);
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[${scope}/deleteEvalCase] Failed query: ${message}`);
    return { ok: false };
  }
}

export async function createEvalRun(
  input: CreateEvalRunInput,
): Promise<{ ok: true; id: string } | { ok: false }> {
  try {
    const inserted = await db
      .insert(evalRuns)
      .values({
        workspaceId: input.workspaceId,
        evalCaseId: input.evalCaseId,
        status: input.status,
        actualReply: input.actualReply,
        answerAnalysis: input.answerAnalysis,
        reasoningForOperators: input.reasoningForOperators ?? null,
        handoffCalled: input.handoffCalled ?? false,
        handoffTopicEntryId: input.handoffTopicEntryId ?? null,
        errorMessage: input.errorMessage ?? null,
        subjectSessionId: input.subjectSessionId,
      })
      .returning({ id: evalRuns.id });

    const id = inserted[0]?.id;
    if (!id) {
      console.error(`[${scope}/createEvalRun] Failed query: missing id`);
      return { ok: false };
    }
    console.info(
      `[${scope}/createEvalRun] Success: userId=${input.workspaceId} id=${id} status=${input.status}`,
    );
    return { ok: true, id };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[${scope}/createEvalRun] Failed query: ${message}`);
    return { ok: false };
  }
}
