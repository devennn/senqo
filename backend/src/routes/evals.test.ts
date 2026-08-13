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
