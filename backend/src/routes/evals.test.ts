import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";

vi.mock("../middleware/auth.js", () => ({
  authMiddleware: async (c: { set: (k: string, v: string) => void }, next: () => Promise<void>) => {
    c.set("userId", "user-1");
    await next();
  },
}));

vi.mock("../middleware/workspace.js", () => ({
  workspaceMiddleware: async (
    c: { set: (k: string, v: string) => void },
    next: () => Promise<void>,
  ) => {
    c.set("workspaceId", "ws-1");
    await next();
  },
}));

vi.mock("../repositories/agent.js", () => ({
  getAgentConfigById: vi.fn(),
  listAgentConfigs: vi.fn(),
}));

vi.mock("../repositories/evals.js", () => ({
  listEvalCasesPage: vi.fn(),
  getEvalCaseById: vi.fn(),
  createManualEvalCase: vi.fn(),
  createEvalCaseFromDraft: vi.fn(),
  updateEvalCase: vi.fn(),
  deleteEvalCase: vi.fn(),
  createEvalRun: vi.fn(),
  parseEvalTurns: vi.fn((turns: unknown) => turns),
}));

vi.mock("../repositories/eval-schedules.js", () => ({
  listEvalCaseIdsWithSchedule: vi.fn(),
  getEvalScheduleByEvalCaseId: vi.fn(),
  createEvalSchedule: vi.fn(),
  updateEvalSchedule: vi.fn(),
  listScheduledRunsPage: vi.fn(),
  listAllEvalSchedules: vi.fn(),
  claimEvalScheduleSlot: vi.fn(),
  setEvalScheduleEnabled: vi.fn(),
}));

vi.mock("../repositories/workspaces.js", () => ({
  isWorkspaceTeammate: vi.fn(),
}));

vi.mock("../repositories/conversations.js", () => ({
  getConversationWithContact: vi.fn(),
  listConversationMessagesLatestPage: vi.fn(),
}));

vi.mock("../repositories/whatsapp.js", () => ({
  getWhatsappConnectionRowById: vi.fn(),
}));

vi.mock("../repositories/response-templates.js", () => ({
  getWorkspaceResponseTemplateEntryForEval: vi.fn(),
}));

vi.mock("../repositories/workspace-context-groups.js", () => ({
  getWorkspaceContextEntryForEval: vi.fn(),
}));

vi.mock("../repositories/handoff-topic-groups.js", () => ({
  getWorkspaceHandoffTopicEntryForEval: vi.fn(),
}));

vi.mock("../agent-evals/business-context.js", () => ({
  loadEvalSpecBusinessContext: vi.fn().mockResolvedValue("We sell widgets."),
}));

vi.mock("../agent-evals/index.js", () => ({
  draftEvalFromReport: vi.fn(),
  draftEvalFromKnowledge: vi.fn(),
  draftEvalFromHandoff: vi.fn(),
  runEvalCase: vi.fn(),
}));

vi.mock("../agent-evals/conversation-to-turns.js", () => ({
  conversationMessagesToEvalTurns: vi.fn(),
  stripTrailingAssistantTurns: (turns: unknown) => turns,
}));

import evalsRoute from "./evals.js";
import { getAgentConfigById, listAgentConfigs } from "../repositories/agent.js";
import {
  createEvalCaseFromDraft,
  createManualEvalCase,
  getEvalCaseById,
  listEvalCasesPage,
} from "../repositories/evals.js";
import {
  createEvalSchedule,
  getEvalScheduleByEvalCaseId,
  listScheduledRunsPage,
  setEvalScheduleEnabled,
} from "../repositories/eval-schedules.js";
import { isWorkspaceTeammate } from "../repositories/workspaces.js";
import { draftEvalFromHandoff, draftEvalFromKnowledge } from "../agent-evals/index.js";
import { getWorkspaceResponseTemplateEntryForEval } from "../repositories/response-templates.js";
import { getWorkspaceContextEntryForEval } from "../repositories/workspace-context-groups.js";
import { getWorkspaceHandoffTopicEntryForEval } from "../repositories/handoff-topic-groups.js";

const getAgentConfigByIdMock = vi.mocked(getAgentConfigById);
const listAgentConfigsMock = vi.mocked(listAgentConfigs);
const createManualEvalCaseMock = vi.mocked(createManualEvalCase);
const createEvalCaseFromDraftMock = vi.mocked(createEvalCaseFromDraft);
const getEvalCaseByIdMock = vi.mocked(getEvalCaseById);
const listEvalCasesPageMock = vi.mocked(listEvalCasesPage);
const createEvalScheduleMock = vi.mocked(createEvalSchedule);
const getEvalScheduleByEvalCaseIdMock = vi.mocked(getEvalScheduleByEvalCaseId);
const listScheduledRunsPageMock = vi.mocked(listScheduledRunsPage);
const setEvalScheduleEnabledMock = vi.mocked(setEvalScheduleEnabled);
const isWorkspaceTeammateMock = vi.mocked(isWorkspaceTeammate);
const getTemplateEntryMock = vi.mocked(getWorkspaceResponseTemplateEntryForEval);
const getContextEntryMock = vi.mocked(getWorkspaceContextEntryForEval);
const getHandoffEntryMock = vi.mocked(getWorkspaceHandoffTopicEntryForEval);
const draftEvalFromKnowledgeMock = vi.mocked(draftEvalFromKnowledge);
const draftEvalFromHandoffMock = vi.mocked(draftEvalFromHandoff);

const AGENT_ID = "a1b2c3d4-e5f6-4789-a012-3456789abcde";
const EVAL_ID = "f1e2d3c4-b5a6-4987-8012-3456789fedcb";

function appWithAuth() {
  const app = new Hono();
  app.use("*", async (c, next) => {
    c.set("userId" as never, "user-1" as never);
    c.set("workspaceId" as never, "ws-1" as never);
    await next();
  });
  app.route("/", evalsRoute);
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("evals routes", () => {
  // Manual create with valid agent → 201 + evalCase, needed to verify create API happy path.
  it("POST /evals → creates a manual case when agent exists", async () => {
    getAgentConfigByIdMock.mockResolvedValue({
      id: AGENT_ID,
      profile_name: "Support",
      behavior: "",
      tools: [],
      skills: [],
      updated_at: "2026-01-01T00:00:00.000Z",
      first_used_at: null,
      auto_assign_conversation_labels: true,
      response_template_groups: [],
      handoff_topic_groups: [],
      context_groups: [],
      asset_groups: [],
      handoff_notify_user_ids: [],
    });
    createManualEvalCaseMock.mockResolvedValue({ ok: true, id: EVAL_ID });
    getEvalCaseByIdMock.mockResolvedValue({
      id: EVAL_ID,
      workspaceId: "ws-1",
      agentId: AGENT_ID,
      agentName: "Support",
      title: "Hours",
      source: "manual",
      status: "ready",
      turns: [{ role: "user", content: "Hours?" }],
      expectedReply: "9-6",
      expectedAction: "reply",
      expectedTopicEntryId: null,
      expectedTopicLabel: null,
      answerAnalysis: null,
      answerCorrect: null,
      sourceConversationId: null,
      runs: [],
      createdAt: "2026-08-13T00:00:00.000Z",
      updatedAt: "2026-08-13T00:00:00.000Z",
    });

    const res = await appWithAuth().request("/evals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Hours",
        agentId: AGENT_ID,
        userMessage: "Hours?",
        expectedReply: "9-6",
        expectedAction: "reply",
        expectedTopicEntryId: null,
        expectedTopicLabel: null,
      }),
    });

    expect(res.status).toBe(201);
    const body = (await res.json()) as { evalCase: { id: string } };
    expect(body.evalCase.id).toBe(EVAL_ID);
  });

  // List without agentId → 400, needed so the UI always scopes to one agent.
  it("GET /evals → rejects missing agentId", async () => {
    const res = await appWithAuth().request("/evals");
    expect(res.status).toBe(400);
    expect(listEvalCasesPageMock).not.toHaveBeenCalled();
  });

  // Template entry → Spec drafts conversation; expected reply stays the template answer.
  it("POST /evals/from-template → creates a ready case from template Q&A", async () => {
    const entryId = "c1c2c3c4-d5d6-4789-a012-3456789abcde";
    const groupId = "b1b2b3b4-c5c6-4789-a012-3456789abcde";
    getTemplateEntryMock.mockResolvedValue({
      id: entryId,
      groupId,
      groupName: "Hours",
      questionText: "What are your hours?",
      answerText: "We are open 9–6.",
    });
    listAgentConfigsMock.mockResolvedValue([
      {
        id: AGENT_ID,
        profile_name: "Support",
        behavior: "",
        tools: [],
        skills: [],
        updated_at: "2026-01-01T00:00:00.000Z",
        first_used_at: null,
        auto_assign_conversation_labels: true,
        response_template_groups: [groupId],
        handoff_topic_groups: [],
        context_groups: [],
        asset_groups: [],
        handoff_notify_user_ids: [],
      },
    ]);
    getAgentConfigByIdMock.mockResolvedValue({
      id: AGENT_ID,
      profile_name: "Support",
      behavior: "",
      tools: [],
      skills: [],
      updated_at: "2026-01-01T00:00:00.000Z",
      first_used_at: null,
      auto_assign_conversation_labels: true,
      response_template_groups: [groupId],
      handoff_topic_groups: [],
      context_groups: [],
      asset_groups: [],
      handoff_notify_user_ids: [],
    });
    draftEvalFromKnowledgeMock.mockResolvedValue({
      ok: true,
      draft: {
        title: "Business hours check",
        turns: [
          { role: "user", content: "Hi", whyReply: "", sources: [] },
          { role: "assistant", content: "Hello!", whyReply: "Greeting", sources: [] },
          { role: "user", content: "What time do you close?", whyReply: "", sources: [] },
        ],
        answerAnalysis: "Checks the agent uses the published hours template.",
      },
    });
    createEvalCaseFromDraftMock.mockResolvedValue({ ok: true, id: EVAL_ID });
    getEvalCaseByIdMock.mockResolvedValue({
      id: EVAL_ID,
      workspaceId: "ws-1",
      agentId: AGENT_ID,
      agentName: "Support",
      title: "Business hours check",
      source: "template",
      status: "ready",
      turns: [
        { role: "user", content: "Hi" },
        { role: "assistant", content: "Hello!" },
        { role: "user", content: "What time do you close?" },
      ],
      expectedReply: "We are open 9–6.",
      expectedAction: "reply",
      expectedTopicEntryId: null,
      expectedTopicLabel: null,
      answerAnalysis: "Checks the agent uses the published hours template.",
      answerCorrect: null,
      sourceConversationId: null,
      runs: [],
      createdAt: "2026-08-13T00:00:00.000Z",
      updatedAt: "2026-08-13T00:00:00.000Z",
    });

    const res = await appWithAuth().request("/evals/from-template", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ templateEntryId: entryId }),
    });

    expect(res.status).toBe(201);
    expect(draftEvalFromKnowledgeMock).toHaveBeenCalledWith(
      expect.objectContaining({ businessContext: "We sell widgets." }),
    );
    expect(createEvalCaseFromDraftMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Business hours check",
        source: "template",
        status: "ready",
        expectedReply: "We are open 9–6.",
        expectedAction: "reply",
        expectedTopicEntryId: null,
        turns: expect.arrayContaining([
          expect.objectContaining({ role: "user", content: "What time do you close?" }),
        ]),
      }),
    );
  });

  // Context fact → Spec drafts conversation; expected reply stays the context body.
  it("POST /evals/from-context → creates a ready case from a context fact", async () => {
    const entryId = "d1d2d3d4-e5e6-4789-a012-3456789abcde";
    const groupId = "e1e2e3e4-f5f6-4789-a012-3456789abcde";
    getContextEntryMock.mockResolvedValue({
      id: entryId,
      groupId,
      groupName: "Ops",
      title: "Delivery options",
      bodyText: "We deliver via Grab and our own drivers.",
    });
    listAgentConfigsMock.mockResolvedValue([
      {
        id: AGENT_ID,
        profile_name: "Support",
        behavior: "",
        tools: [],
        skills: [],
        updated_at: "2026-01-01T00:00:00.000Z",
        first_used_at: null,
        auto_assign_conversation_labels: true,
        response_template_groups: [],
        handoff_topic_groups: [],
        context_groups: [groupId],
        asset_groups: [],
        handoff_notify_user_ids: [],
      },
    ]);
    getAgentConfigByIdMock.mockResolvedValue({
      id: AGENT_ID,
      profile_name: "Support",
      behavior: "",
      tools: [],
      skills: [],
      updated_at: "2026-01-01T00:00:00.000Z",
      first_used_at: null,
      auto_assign_conversation_labels: true,
      response_template_groups: [],
      handoff_topic_groups: [],
      context_groups: [groupId],
      asset_groups: [],
      handoff_notify_user_ids: [],
    });
    draftEvalFromKnowledgeMock.mockResolvedValue({
      ok: true,
      draft: {
        title: "Delivery options check",
        turns: [{ role: "user", content: "Do you deliver food?", whyReply: "", sources: [] }],
        answerAnalysis: "Checks delivery facts from workspace context.",
      },
    });
    createEvalCaseFromDraftMock.mockResolvedValue({ ok: true, id: EVAL_ID });
    getEvalCaseByIdMock.mockResolvedValue({
      id: EVAL_ID,
      workspaceId: "ws-1",
      agentId: AGENT_ID,
      agentName: "Support",
      title: "Delivery options check",
      source: "context",
      status: "ready",
      turns: [{ role: "user", content: "Do you deliver food?" }],
      expectedReply: "We deliver via Grab and our own drivers.",
      expectedAction: "reply",
      expectedTopicEntryId: null,
      expectedTopicLabel: null,
      answerAnalysis: "Checks delivery facts from workspace context.",
      answerCorrect: null,
      sourceConversationId: null,
      runs: [],
      createdAt: "2026-08-13T00:00:00.000Z",
      updatedAt: "2026-08-13T00:00:00.000Z",
    });

    const res = await appWithAuth().request("/evals/from-context", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contextEntryId: entryId }),
    });

    expect(res.status).toBe(201);
    expect(draftEvalFromKnowledgeMock).toHaveBeenCalledWith(
      expect.objectContaining({ businessContext: "We sell widgets." }),
    );
    expect(createEvalCaseFromDraftMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Delivery options check",
        source: "context",
        expectedReply: "We deliver via Grab and our own drivers.",
        expectedAction: "reply",
        expectedTopicEntryId: null,
        turns: [{ role: "user", content: "Do you deliver food?", whyReply: "", sources: [] }],
      }),
    );
  });

  // Handoff topic → Spec drafts conversation; expected action is handoff with topic id.
  it("POST /evals/from-handoff → creates a ready handoff action case", async () => {
    const entryId = "f1f2f3f4-a5b6-4789-a012-3456789abcde";
    const groupId = "a1a2a3a4-b5c6-4789-a012-3456789abcde";
    getHandoffEntryMock.mockResolvedValue({
      id: entryId,
      groupId,
      groupName: "Escalations",
      topic: "Refund disputes",
      description: "Customer disputes a refund decision.",
    });
    listAgentConfigsMock.mockResolvedValue([
      {
        id: AGENT_ID,
        profile_name: "Support",
        behavior: "",
        tools: [],
        skills: [],
        updated_at: "2026-01-01T00:00:00.000Z",
        first_used_at: null,
        auto_assign_conversation_labels: true,
        response_template_groups: [],
        handoff_topic_groups: [groupId],
        context_groups: [],
        asset_groups: [],
        handoff_notify_user_ids: [],
      },
    ]);
    getAgentConfigByIdMock.mockResolvedValue({
      id: AGENT_ID,
      profile_name: "Support",
      behavior: "",
      tools: [],
      skills: [],
      updated_at: "2026-01-01T00:00:00.000Z",
      first_used_at: null,
      auto_assign_conversation_labels: true,
      response_template_groups: [],
      handoff_topic_groups: [groupId],
      context_groups: [],
      asset_groups: [],
      handoff_notify_user_ids: [],
    });
    draftEvalFromHandoffMock.mockResolvedValue({
      ok: true,
      draft: {
        title: "Refund dispute handoff",
        turns: [
          { role: "user", content: "I disagree with your refund denial", whyReply: "", sources: [] },
        ],
        answerAnalysis: "Expects handoff for refund disputes.",
      },
    });
    createEvalCaseFromDraftMock.mockResolvedValue({ ok: true, id: EVAL_ID });
    getEvalCaseByIdMock.mockResolvedValue({
      id: EVAL_ID,
      workspaceId: "ws-1",
      agentId: AGENT_ID,
      agentName: "Support",
      title: "Refund dispute handoff",
      source: "handoff",
      status: "ready",
      turns: [
        { role: "user", content: "I disagree with your refund denial" },
      ],
      expectedReply: "",
      expectedAction: "handoff",
      expectedTopicEntryId: entryId,
      expectedTopicLabel: "Refund disputes",
      answerAnalysis: "Expects handoff for refund disputes.",
      answerCorrect: null,
      sourceConversationId: null,
      runs: [],
      createdAt: "2026-08-13T00:00:00.000Z",
      updatedAt: "2026-08-13T00:00:00.000Z",
    });

    const res = await appWithAuth().request("/evals/from-handoff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ handoffTopicEntryId: entryId }),
    });

    expect(res.status).toBe(201);
    expect(draftEvalFromHandoffMock).toHaveBeenCalledWith(
      expect.objectContaining({
        topicEntryId: entryId,
        businessContext: "We sell widgets.",
      }),
    );
    expect(createEvalCaseFromDraftMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "handoff",
        expectedAction: "handoff",
        expectedTopicEntryId: entryId,
        expectedReply: "",
      }),
    );
  });
});

const NOTIFY_USER_ID = "11111111-1111-4111-8111-111111111111";

const SCHEDULE_BODY = {
  repeat: "weekly" as const,
  weekdays: [0],
  monthDay: 1,
  hour: 20,
  minute: 0,
  timezone: "Asia/Kuala_Lumpur",
  notifyUserId: NOTIFY_USER_ID,
};

function evalCaseStub() {
  return {
    id: EVAL_ID,
    workspaceId: "ws-1",
    agentId: AGENT_ID,
    agentName: "Support",
    title: "Hours",
    source: "manual" as const,
    status: "ready" as const,
    turns: [{ role: "user" as const, content: "Hours?" }],
    expectedReply: "9-6",
    expectedAction: "reply" as const,
    expectedTopicEntryId: null,
    expectedTopicLabel: null,
    expectedTopicDescription: null,
    answerAnalysis: null,
    answerCorrect: null,
    sourceConversationId: null,
    runs: [],
    hasSchedule: false,
    createdAt: "2026-08-13T00:00:00.000Z",
    updatedAt: "2026-08-13T00:00:00.000Z",
  };
}

describe("eval schedule routes", () => {
  // Create schedule for a member → 201, needed so the Schedule tab can persist cadence.
  it("POST /evals/:id/schedule → creates when the eval exists and notify user is a member", async () => {
    getEvalCaseByIdMock.mockResolvedValue(evalCaseStub());
    isWorkspaceTeammateMock.mockResolvedValue(true);
    createEvalScheduleMock.mockResolvedValue({ ok: true, id: "sched-1" });
    getEvalScheduleByEvalCaseIdMock.mockResolvedValue({
      id: "sched-1",
      workspaceId: "ws-1",
      evalCaseId: EVAL_ID,
      ...SCHEDULE_BODY,
      monthDay: null,
      enabled: true,
      lastFiredAt: null,
      createdAt: "2026-08-13T00:00:00.000Z",
      updatedAt: "2026-08-13T00:00:00.000Z",
    });

    const res = await appWithAuth().request(`/evals/${EVAL_ID}/schedule`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(SCHEDULE_BODY),
    });

    expect(res.status).toBe(201);
    const payload = await res.json();
    expect(payload.schedule.notifyUserId).toBe(NOTIFY_USER_ID);
    expect(payload.schedule.repeat).toBe("weekly");
  });

  // Second create for the same eval → 409, needed so one schedule per eval is enforced.
  it("POST /evals/:id/schedule → 409 when a schedule already exists", async () => {
    getEvalCaseByIdMock.mockResolvedValue(evalCaseStub());
    isWorkspaceTeammateMock.mockResolvedValue(true);
    createEvalScheduleMock.mockResolvedValue({ ok: false, error: "exists" });

    const res = await appWithAuth().request(`/evals/${EVAL_ID}/schedule`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(SCHEDULE_BODY),
    });

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "schedule_exists" });
  });

  // Notify user is not owner/member → 422, needed so mail cannot target outsiders.
  it("POST /evals/:id/schedule → 422 when notify user is not a workspace member", async () => {
    getEvalCaseByIdMock.mockResolvedValue(evalCaseStub());
    isWorkspaceTeammateMock.mockResolvedValue(false);

    const res = await appWithAuth().request(`/evals/${EVAL_ID}/schedule`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(SCHEDULE_BODY),
    });

    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ error: "notify_not_member" });
  });

  // Paginated scheduled runs for that eval → 200 with the run payload.
  it("GET /evals/:id/scheduled-runs → returns this eval’s scheduled runs", async () => {
    getEvalCaseByIdMock.mockResolvedValue({ ...evalCaseStub(), hasSchedule: true });
    listScheduledRunsPageMock.mockResolvedValue({
      items: [
        {
          id: "run-1",
          status: "failed",
          actualReply: "Wrong hours.",
          answerAnalysis: null,
          reasoningForOperators: null,
          handoffCalled: false,
          handoffTopicEntryId: null,
          handoffTopicLabel: null,
          errorMessage: null,
          subjectSessionId: null,
          ranAt: "2026-08-13T09:00:00.000Z",
          emailSent: true,
          notifyEmail: "ops@example.com",
        },
      ],
      total: 1,
    });

    const res = await appWithAuth().request(`/evals/${EVAL_ID}/scheduled-runs?page=1`);
    expect(res.status).toBe(200);
    const payload = await res.json();
    expect(payload.total).toBe(1);
    expect(payload.runs[0].actualReply).toBe("Wrong hours.");
    expect(payload.pageSize).toBe(5);
  });

  // PATCH enabled false → 200, needed so Turn off stops future runs without deleting the cadence.
  it("PATCH /evals/:id/schedule → sets enabled to false", async () => {
    getEvalCaseByIdMock.mockResolvedValue({ ...evalCaseStub(), hasSchedule: true });
    getEvalScheduleByEvalCaseIdMock
      .mockResolvedValueOnce({
        id: "sched-1",
        workspaceId: "ws-1",
        evalCaseId: EVAL_ID,
        ...SCHEDULE_BODY,
        monthDay: null,
        enabled: true,
        lastFiredAt: null,
        createdAt: "2026-08-13T00:00:00.000Z",
        updatedAt: "2026-08-13T00:00:00.000Z",
      })
      .mockResolvedValueOnce({
        id: "sched-1",
        workspaceId: "ws-1",
        evalCaseId: EVAL_ID,
        ...SCHEDULE_BODY,
        monthDay: null,
        enabled: false,
        lastFiredAt: null,
        createdAt: "2026-08-13T00:00:00.000Z",
        updatedAt: "2026-08-13T00:00:00.000Z",
      });
    setEvalScheduleEnabledMock.mockResolvedValue({ ok: true });

    const res = await appWithAuth().request(`/evals/${EVAL_ID}/schedule`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: false }),
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      schedule: {
        ...SCHEDULE_BODY,
        monthDay: null,
        enabled: false,
      },
    });
  });
});
