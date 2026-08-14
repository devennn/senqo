import { Hono } from "hono";
import { z } from "zod";
import type { AuthVariables } from "../middleware/auth.js";
import type { WorkspaceVariables } from "../middleware/workspace.js";
import { parseListPageParams } from "../lib/pagination.js";
import { getAgentConfigById, listAgentConfigs } from "../repositories/agent.js";
import {
  createEvalCaseFromDraft,
  createManualEvalCase,
  deleteEvalCase,
  getEvalCaseById,
  listEvalCasesPage,
  parseEvalTurns,
  updateEvalCase,
} from "../repositories/evals.js";
import {
  createEvalSchedule,
  getEvalScheduleByEvalCaseId,
  listScheduledRunsPage,
  setEvalScheduleEnabled,
  updateEvalSchedule,
} from "../repositories/eval-schedules.js";
import { isWorkspaceTeammate } from "../repositories/workspaces.js";
import { runAndPersistEvalCase } from "../services/eval-run.js";
import type { EvalScheduleRecord } from "../types/evals.js";
import {
  getConversationWithContact,
  listConversationMessagesLatestPage,
} from "../repositories/conversations.js";
import { getWhatsappConnectionRowById } from "../repositories/whatsapp.js";
import { getWorkspaceResponseTemplateEntryForEval } from "../repositories/response-templates.js";
import { getWorkspaceContextEntryForEval } from "../repositories/workspace-context-groups.js";
import { getWorkspaceHandoffTopicEntryForEval } from "../repositories/handoff-topic-groups.js";
import { loadEvalSpecBusinessContext } from "../agent-evals/business-context.js";
import { conversationMessagesToEvalTurns, stripTrailingAssistantTurns } from "../agent-evals/conversation-to-turns.js";
import {
  draftEvalFromHandoff,
  draftEvalFromKnowledge,
  draftEvalFromReport,
} from "../agent-evals/index.js";

type Variables = AuthVariables & WorkspaceVariables;

const app = new Hono<{ Variables: Variables }>();

const EVALS_DEFAULT_PAGE_SIZE = 8;
const EVAL_SCHEDULED_RUN_PAGE_SIZE = 5;

const knowledgeRefSchema = z.object({
  kind: z.enum(["context", "template", "skill", "handoff"]),
  label: z.string().min(1),
});

const turnSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
  media: z
    .object({
      path: z.string().optional(),
      storageBucket: z.string().optional(),
      fileName: z.string().optional(),
      mimeType: z.string().optional(),
      caption: z.string().optional(),
      sourceUrl: z.string().optional(),
      signedUrl: z.string().optional(),
      fileSizeBytes: z.number().optional(),
    })
    .nullable()
    .optional(),
  whyReply: z.string().nullable().optional(),
  sources: z.array(knowledgeRefSchema).optional(),
});

const createManualSchema = z.object({
  title: z.string().trim().min(1).max(200),
  agentId: z.string().uuid(),
  userMessage: z.string().trim().min(1).max(10_000),
  expectedReply: z.string().trim().min(1).max(20_000),
});

const fromConversationSchema = z.object({
  conversationId: z.string().uuid(),
  answerAnalysis: z.string().trim().min(1).max(10_000),
  expectedGuidance: z.string().trim().min(1).max(10_000),
  agentId: z.string().uuid().optional(),
});

const fromTemplateSchema = z.object({
  templateEntryId: z.string().uuid(),
  agentId: z.string().uuid().optional(),
});

const fromContextSchema = z.object({
  contextEntryId: z.string().uuid(),
  agentId: z.string().uuid().optional(),
});

const fromHandoffSchema = z.object({
  handoffTopicEntryId: z.string().uuid(),
  agentId: z.string().uuid().optional(),
});

function evalTitleFromText(text: string): string {
  const trimmed = text.trim().replace(/\s+/g, " ");
  if (trimmed.length <= 120) return trimmed;
  return `${trimmed.slice(0, 117).trimEnd()}…`;
}

async function resolveEvalAgentId(
  workspaceId: string,
  preferredAgentId: string | undefined,
  groupId: string,
  attachment: "templates" | "context" | "handoff",
): Promise<string | null> {
  if (preferredAgentId) {
    const agent = await getAgentConfigById(workspaceId, preferredAgentId);
    return agent ? preferredAgentId : null;
  }

  const agents = await listAgentConfigs(workspaceId);
  if (agents.length === 0) return null;
  const attached = agents.find((agent) => {
    if (attachment === "templates") return agent.response_template_groups.includes(groupId);
    if (attachment === "context") return agent.context_groups.includes(groupId);
    return agent.handoff_topic_groups.includes(groupId);
  });
  return attached?.id ?? agents[0]?.id ?? null;
}

const updateEvalSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  status: z.enum(["draft", "ready"]).optional(),
  expectedReply: z.string().trim().max(20_000).optional(),
  turns: z.array(turnSchema).min(1).optional(),
  answerAnalysis: z.string().nullable().optional(),
  answerCorrect: z.boolean().nullable().optional(),
});

const scheduleBodySchema = z
  .object({
    repeat: z.enum(["daily", "weekly", "monthly"]),
    weekdays: z.array(z.number().int().min(0).max(6)).max(7),
    monthDay: z.number().int().min(1).max(31).nullable().optional(),
    hour: z.number().int().min(0).max(23),
    minute: z.number().int().min(0).max(59),
    timezone: z.string().trim().min(1).max(64),
    notifyUserId: z.string().uuid(),
  })
  .superRefine((data, ctx) => {
    if (data.repeat === "weekly" && data.weekdays.length === 0) {
      ctx.addIssue({ code: "custom", path: ["weekdays"], message: "weekdays_required" });
    }
    if (data.repeat === "monthly" && data.monthDay == null) {
      ctx.addIssue({ code: "custom", path: ["monthDay"], message: "month_day_required" });
    }
    try {
      Intl.DateTimeFormat("en-US", { timeZone: data.timezone });
    } catch {
      ctx.addIssue({ code: "custom", path: ["timezone"], message: "invalid_timezone" });
    }
  });

function uniqueWeekdays(weekdays: number[]): number[] {
  return [...new Set(weekdays)].sort((a, b) => a - b);
}

function schedulePayload(schedule: EvalScheduleRecord) {
  return {
    repeat: schedule.repeat,
    weekdays: schedule.weekdays,
    monthDay: schedule.monthDay,
    hour: schedule.hour,
    minute: schedule.minute,
    timezone: schedule.timezone,
    notifyUserId: schedule.notifyUserId,
    enabled: schedule.enabled,
  };
}

app.get("/evals", async (c) => {
  const workspaceId = c.get("workspaceId");
  const agentId = c.req.query("agentId")?.trim() ?? "";
  if (!agentId) return c.json({ error: "agent_id_required" }, 400);

  const agent = await getAgentConfigById(workspaceId, agentId);
  if (!agent) return c.json({ error: "agent_not_found" }, 404);

  const { page, pageSize } = parseListPageParams(
    c.req.query("page"),
    c.req.query("pageSize"),
    EVALS_DEFAULT_PAGE_SIZE,
  );

  const result = await listEvalCasesPage({
    workspaceId,
    agentConfigId: agentId,
    page,
    pageSize,
  });

  return c.json({
    cases: result.items,
    total: result.total,
    page,
    pageSize,
  });
});

app.get("/evals/:id", async (c) => {
  const workspaceId = c.get("workspaceId");
  const id = c.req.param("id");
  const evalCase = await getEvalCaseById(workspaceId, id);
  if (!evalCase) return c.json({ error: "not_found" }, 404);
  return c.json({ evalCase });
});

app.get("/evals/:id/schedule", async (c) => {
  const workspaceId = c.get("workspaceId");
  const id = c.req.param("id");
  const evalCase = await getEvalCaseById(workspaceId, id);
  if (!evalCase) return c.json({ error: "not_found" }, 404);
  const schedule = await getEvalScheduleByEvalCaseId(workspaceId, id);
  if (!schedule) return c.json({ error: "not_found" }, 404);
  return c.json({ schedule: schedulePayload(schedule) });
});

app.post("/evals/:id/schedule", async (c) => {
  const workspaceId = c.get("workspaceId");
  const id = c.req.param("id");
  const evalCase = await getEvalCaseById(workspaceId, id);
  if (!evalCase) return c.json({ error: "not_found" }, 404);

  const parsed = scheduleBodySchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "invalid_payload" }, 400);

  const teammate = await isWorkspaceTeammate(workspaceId, parsed.data.notifyUserId);
  if (!teammate) return c.json({ error: "notify_not_member" }, 422);

  const created = await createEvalSchedule({
    workspaceId,
    evalCaseId: id,
    repeat: parsed.data.repeat,
    weekdays: uniqueWeekdays(parsed.data.weekdays),
    monthDay: parsed.data.repeat === "monthly" ? (parsed.data.monthDay ?? 1) : null,
    hour: parsed.data.hour,
    minute: parsed.data.minute,
    timezone: parsed.data.timezone,
    notifyUserId: parsed.data.notifyUserId,
  });
  if (!created.ok) {
    if (created.error === "exists") return c.json({ error: "schedule_exists" }, 409);
    return c.json({ error: "create_failed" }, 500);
  }

  const schedule = await getEvalScheduleByEvalCaseId(workspaceId, id);
  if (!schedule) return c.json({ error: "create_failed" }, 500);
  return c.json({ schedule: schedulePayload(schedule) }, 201);
});

app.put("/evals/:id/schedule", async (c) => {
  const workspaceId = c.get("workspaceId");
  const id = c.req.param("id");
  const evalCase = await getEvalCaseById(workspaceId, id);
  if (!evalCase) return c.json({ error: "not_found" }, 404);

  const parsed = scheduleBodySchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "invalid_payload" }, 400);

  const teammate = await isWorkspaceTeammate(workspaceId, parsed.data.notifyUserId);
  if (!teammate) return c.json({ error: "notify_not_member" }, 422);

  const existing = await getEvalScheduleByEvalCaseId(workspaceId, id);
  if (!existing) return c.json({ error: "not_found" }, 404);

  const updated = await updateEvalSchedule(workspaceId, id, {
    repeat: parsed.data.repeat,
    weekdays: uniqueWeekdays(parsed.data.weekdays),
    monthDay: parsed.data.repeat === "monthly" ? (parsed.data.monthDay ?? 1) : null,
    hour: parsed.data.hour,
    minute: parsed.data.minute,
    timezone: parsed.data.timezone,
    notifyUserId: parsed.data.notifyUserId,
  });
  if (!updated.ok) return c.json({ error: "update_failed" }, 500);

  const schedule = await getEvalScheduleByEvalCaseId(workspaceId, id);
  if (!schedule) return c.json({ error: "not_found" }, 404);
  return c.json({ schedule: schedulePayload(schedule) });
});

app.patch("/evals/:id/schedule", async (c) => {
  const workspaceId = c.get("workspaceId");
  const id = c.req.param("id");
  const evalCase = await getEvalCaseById(workspaceId, id);
  if (!evalCase) return c.json({ error: "not_found" }, 404);

  const parsed = z.object({ enabled: z.boolean() }).safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "invalid_payload" }, 400);

  const existing = await getEvalScheduleByEvalCaseId(workspaceId, id);
  if (!existing) return c.json({ error: "not_found" }, 404);

  const updated = await setEvalScheduleEnabled(workspaceId, id, parsed.data.enabled);
  if (!updated.ok) return c.json({ error: "update_failed" }, 500);

  const schedule = await getEvalScheduleByEvalCaseId(workspaceId, id);
  if (!schedule) return c.json({ error: "not_found" }, 404);
  return c.json({ schedule: schedulePayload(schedule) });
});

app.get("/evals/:id/scheduled-runs", async (c) => {
  const workspaceId = c.get("workspaceId");
  const id = c.req.param("id");
  const evalCase = await getEvalCaseById(workspaceId, id);
  if (!evalCase) return c.json({ error: "not_found" }, 404);

  const { page, pageSize } = parseListPageParams(
    c.req.query("page"),
    c.req.query("pageSize"),
    EVAL_SCHEDULED_RUN_PAGE_SIZE,
  );
  const result = await listScheduledRunsPage({
    workspaceId,
    evalCaseId: id,
    page,
    pageSize,
  });
  return c.json({
    runs: result.items,
    total: result.total,
    page,
    pageSize,
  });
});

app.post("/evals", async (c) => {
  const workspaceId = c.get("workspaceId");
  const parsed = createManualSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "invalid_payload" }, 400);

  const agent = await getAgentConfigById(workspaceId, parsed.data.agentId);
  if (!agent) return c.json({ error: "agent_not_found" }, 404);

  const created = await createManualEvalCase({
    workspaceId,
    agentConfigId: parsed.data.agentId,
    title: parsed.data.title,
    userMessage: parsed.data.userMessage,
    expectedReply: parsed.data.expectedReply,
  });
  if (!created.ok) return c.json({ error: "create_failed" }, 500);

  const evalCase = await getEvalCaseById(workspaceId, created.id);
  if (!evalCase) return c.json({ error: "create_failed" }, 500);
  return c.json({ evalCase }, 201);
});

app.post("/evals/from-conversation", async (c) => {
  const workspaceId = c.get("workspaceId");
  const parsed = fromConversationSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "invalid_payload" }, 400);

  const conversation = await getConversationWithContact(
    workspaceId,
    parsed.data.conversationId,
  );
  if (!conversation) return c.json({ error: "conversation_not_found" }, 404);

  let agentConfigId = parsed.data.agentId?.trim() ?? "";
  if (!agentConfigId) {
    const connectionId = conversation.whatsappConnection?.id?.trim() ?? "";
    if (!connectionId) {
      return c.json({ error: "conversation_has_no_agent" }, 400);
    }
    const connection = await getWhatsappConnectionRowById(workspaceId, connectionId);
    agentConfigId = connection?.agent_config_id?.trim() ?? "";
  }
  if (!agentConfigId) {
    return c.json({ error: "conversation_has_no_agent" }, 400);
  }

  const agent = await getAgentConfigById(workspaceId, agentConfigId);
  if (!agent) return c.json({ error: "agent_not_found" }, 404);

  // Load a large latest page so Spec sees most of the thread.
  const page = await listConversationMessagesLatestPage(
    workspaceId,
    parsed.data.conversationId,
    200,
  );
  const turns = conversationMessagesToEvalTurns(page.messages);
  if (turns.length === 0) {
    return c.json({ error: "conversation_empty" }, 400);
  }

  const businessContext = await loadEvalSpecBusinessContext(workspaceId, agentConfigId);
  const drafted = await draftEvalFromReport({
    conversationTitle: conversation.title,
    agentName: agent.profile_name,
    turns,
    answerAnalysisGuidance: parsed.data.answerAnalysis,
    expectedReplyGuidance: parsed.data.expectedGuidance,
    businessContext,
  });
  if (!drafted.ok) {
    return c.json({ error: "spec_failed", message: drafted.message }, 502);
  }

  const draftTurns = stripTrailingAssistantTurns(parseEvalTurns(drafted.draft.turns));
  const fallbackTurns = stripTrailingAssistantTurns(turns);
  const created = await createEvalCaseFromDraft({
    workspaceId,
    agentConfigId,
    title: drafted.draft.title,
    source: "conversation",
    status: "ready",
    turns: draftTurns.length > 0 ? draftTurns : fallbackTurns,
    expectedReply: drafted.draft.expectedReply,
    expectedAction: "reply",
    expectedTopicEntryId: null,
    answerAnalysis: drafted.draft.answerAnalysis,
    /** Not run yet — pass/fail comes from Judge after Run. */
    answerCorrect: null,
    sourceConversationId: parsed.data.conversationId,
  });
  if (!created.ok) return c.json({ error: "create_failed" }, 500);

  const evalCase = await getEvalCaseById(workspaceId, created.id);
  if (!evalCase) return c.json({ error: "create_failed" }, 500);
  return c.json({ evalCase }, 201);
});

app.post("/evals/from-template", async (c) => {
  const workspaceId = c.get("workspaceId");
  const parsed = fromTemplateSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "invalid_payload" }, 400);

  const entry = await getWorkspaceResponseTemplateEntryForEval(
    workspaceId,
    parsed.data.templateEntryId,
  );
  if (!entry) return c.json({ error: "template_entry_not_found" }, 404);

  const question = entry.questionText.trim();
  const answer = entry.answerText.trim();
  if (!question || !answer) {
    return c.json({ error: "template_entry_incomplete" }, 400);
  }

  const agentConfigId = await resolveEvalAgentId(
    workspaceId,
    parsed.data.agentId,
    entry.groupId,
    "templates",
  );
  if (!agentConfigId) return c.json({ error: "agent_not_found" }, 404);

  const agent = await getAgentConfigById(workspaceId, agentConfigId);
  if (!agent) return c.json({ error: "agent_not_found" }, 404);

  const businessContext = await loadEvalSpecBusinessContext(workspaceId, agentConfigId);
  const drafted = await draftEvalFromKnowledge({
    kind: "template",
    groupName: entry.groupName,
    agentName: agent.profile_name,
    seedPrompt: question,
    expectedReply: answer,
    businessContext,
  });
  if (!drafted.ok) {
    return c.json({ error: "spec_failed", message: drafted.message }, 502);
  }

  const draftTurns = stripTrailingAssistantTurns(parseEvalTurns(drafted.draft.turns));
  const fallbackTurns: ReturnType<typeof parseEvalTurns> = [
    { role: "user", content: question },
  ];
  const created = await createEvalCaseFromDraft({
    workspaceId,
    agentConfigId,
    title: drafted.draft.title.trim() || evalTitleFromText(question),
    source: "template",
    status: "ready",
    turns: draftTurns.length > 0 ? draftTurns : fallbackTurns,
    expectedReply: answer,
    expectedAction: "reply",
    expectedTopicEntryId: null,
    answerAnalysis: drafted.draft.answerAnalysis.trim() || null,
    answerCorrect: null,
    sourceConversationId: null,
  });
  if (!created.ok) return c.json({ error: "create_failed" }, 500);

  const evalCase = await getEvalCaseById(workspaceId, created.id);
  if (!evalCase) return c.json({ error: "create_failed" }, 500);
  return c.json({ evalCase }, 201);
});

app.post("/evals/from-context", async (c) => {
  const workspaceId = c.get("workspaceId");
  const parsed = fromContextSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "invalid_payload" }, 400);

  const entry = await getWorkspaceContextEntryForEval(
    workspaceId,
    parsed.data.contextEntryId,
  );
  if (!entry) return c.json({ error: "context_entry_not_found" }, 404);

  const title = entry.title.trim();
  const body = entry.bodyText.trim();
  if (!title || !body) {
    return c.json({ error: "context_entry_incomplete" }, 400);
  }

  const agentConfigId = await resolveEvalAgentId(
    workspaceId,
    parsed.data.agentId,
    entry.groupId,
    "context",
  );
  if (!agentConfigId) return c.json({ error: "agent_not_found" }, 404);

  const agent = await getAgentConfigById(workspaceId, agentConfigId);
  if (!agent) return c.json({ error: "agent_not_found" }, 404);

  const businessContext = await loadEvalSpecBusinessContext(workspaceId, agentConfigId);
  const drafted = await draftEvalFromKnowledge({
    kind: "context",
    groupName: entry.groupName,
    agentName: agent.profile_name,
    seedPrompt: title,
    expectedReply: body,
    businessContext,
  });
  if (!drafted.ok) {
    return c.json({ error: "spec_failed", message: drafted.message }, 502);
  }

  const draftTurns = stripTrailingAssistantTurns(parseEvalTurns(drafted.draft.turns));
  const fallbackTurns: ReturnType<typeof parseEvalTurns> = [
    { role: "user", content: title },
  ];
  const created = await createEvalCaseFromDraft({
    workspaceId,
    agentConfigId,
    title: drafted.draft.title.trim() || evalTitleFromText(title),
    source: "context",
    status: "ready",
    turns: draftTurns.length > 0 ? draftTurns : fallbackTurns,
    expectedReply: body,
    expectedAction: "reply",
    expectedTopicEntryId: null,
    answerAnalysis: drafted.draft.answerAnalysis.trim() || null,
    answerCorrect: null,
    sourceConversationId: null,
  });
  if (!created.ok) return c.json({ error: "create_failed" }, 500);

  const evalCase = await getEvalCaseById(workspaceId, created.id);
  if (!evalCase) return c.json({ error: "create_failed" }, 500);
  return c.json({ evalCase }, 201);
});

app.post("/evals/from-handoff", async (c) => {
  const workspaceId = c.get("workspaceId");
  const parsed = fromHandoffSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "invalid_payload" }, 400);

  const entry = await getWorkspaceHandoffTopicEntryForEval(
    workspaceId,
    parsed.data.handoffTopicEntryId,
  );
  if (!entry) return c.json({ error: "handoff_topic_not_found" }, 404);

  const topic = entry.topic.trim();
  if (!topic) {
    return c.json({ error: "handoff_topic_incomplete" }, 400);
  }

  const agentConfigId = await resolveEvalAgentId(
    workspaceId,
    parsed.data.agentId,
    entry.groupId,
    "handoff",
  );
  if (!agentConfigId) return c.json({ error: "agent_not_found" }, 404);

  const agent = await getAgentConfigById(workspaceId, agentConfigId);
  if (!agent) return c.json({ error: "agent_not_found" }, 404);

  const businessContext = await loadEvalSpecBusinessContext(workspaceId, agentConfigId);
  const drafted = await draftEvalFromHandoff({
    groupName: entry.groupName,
    agentName: agent.profile_name,
    topicTitle: topic,
    topicDescription: entry.description,
    topicEntryId: entry.id,
    businessContext,
  });
  if (!drafted.ok) {
    return c.json({ error: "spec_failed", message: drafted.message }, 502);
  }

  const draftTurns = stripTrailingAssistantTurns(parseEvalTurns(drafted.draft.turns));
  const fallbackTurns: ReturnType<typeof parseEvalTurns> = [
    { role: "user", content: topic },
  ];
  const created = await createEvalCaseFromDraft({
    workspaceId,
    agentConfigId,
    title: drafted.draft.title.trim() || evalTitleFromText(topic),
    source: "handoff",
    status: "ready",
    turns: draftTurns.length > 0 ? draftTurns : fallbackTurns,
    expectedReply: "",
    expectedAction: "handoff",
    expectedTopicEntryId: entry.id,
    answerAnalysis: drafted.draft.answerAnalysis.trim() || null,
    answerCorrect: null,
    sourceConversationId: null,
  });
  if (!created.ok) return c.json({ error: "create_failed" }, 500);

  const evalCase = await getEvalCaseById(workspaceId, created.id);
  if (!evalCase) return c.json({ error: "create_failed" }, 500);
  return c.json({ evalCase }, 201);
});

app.put("/evals/:id", async (c) => {
  const workspaceId = c.get("workspaceId");
  const id = c.req.param("id");
  const parsed = updateEvalSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "invalid_payload" }, 400);

  const existing = await getEvalCaseById(workspaceId, id);
  if (!existing) return c.json({ error: "not_found" }, 404);

  const updated = await updateEvalCase(workspaceId, id, {
    title: parsed.data.title,
    status: parsed.data.status,
    expectedReply: parsed.data.expectedReply,
    turns: parsed.data.turns,
    answerAnalysis: parsed.data.answerAnalysis,
    answerCorrect: parsed.data.answerCorrect,
  });
  if (!updated.ok) return c.json({ error: "update_failed" }, 500);

  const evalCase = await getEvalCaseById(workspaceId, id);
  if (!evalCase) return c.json({ error: "not_found" }, 404);
  return c.json({ evalCase });
});

app.post("/evals/:id/run", async (c) => {
  const workspaceId = c.get("workspaceId");
  const id = c.req.param("id");
  const result = await runAndPersistEvalCase({ workspaceId, evalCaseId: id });
  if (!result.ok) return c.json({ error: result.error }, result.httpStatus);
  return c.json({ evalCase: result.evalCase });
});

app.delete("/evals/:id", async (c) => {
  const workspaceId = c.get("workspaceId");
  const id = c.req.param("id");
  const deleted = await deleteEvalCase(workspaceId, id);
  if (!deleted.ok) return c.json({ error: "not_found" }, 404);
  return c.json({ ok: true });
});

export default app;
