import "./user-route-test-mocks.js";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";

vi.mock("../services/agent-knowledge-import-generate.js", () => ({
  generateAgentKnowledgeImportDraft: vi.fn(),
}));

import { verifyToken } from "../lib/auth-jwt.js";
import { validateWorkspaceMembership } from "../repositories/workspaces.js";
import { getAgentConfigById, updateAgentConfig } from "../repositories/agent.js";
import {
  addWorkspaceContextEntry,
  createWorkspaceContextGroup,
} from "../repositories/workspace-context-groups.js";
import {
  addWorkspaceResponseTemplateEntry,
  createWorkspaceResponseTemplateGroup,
} from "../repositories/response-templates.js";
import { createWorkspaceSkill, getWorkspaceSkillById } from "../repositories/skills.js";
import { generateAgentKnowledgeImportDraft } from "../services/agent-knowledge-import-generate.js";
import type { AgentKnowledgeImportDraft } from "../types/agent-knowledge-import.js";

const verifyTokenMock = vi.mocked(verifyToken);
const validateWorkspaceMembershipMock = vi.mocked(validateWorkspaceMembership);
const getAgentConfigByIdMock = vi.mocked(getAgentConfigById);
const updateAgentConfigMock = vi.mocked(updateAgentConfig);
const createWorkspaceContextGroupMock = vi.mocked(createWorkspaceContextGroup);
const addWorkspaceContextEntryMock = vi.mocked(addWorkspaceContextEntry);
const createWorkspaceSkillMock = vi.mocked(createWorkspaceSkill);
const getWorkspaceSkillByIdMock = vi.mocked(getWorkspaceSkillById);
const createWorkspaceResponseTemplateGroupMock = vi.mocked(createWorkspaceResponseTemplateGroup);
const addWorkspaceResponseTemplateEntryMock = vi.mocked(addWorkspaceResponseTemplateEntry);
const generateDraftMock = vi.mocked(generateAgentKnowledgeImportDraft);

let app: Hono;

const AUTH = {
  Authorization: "Bearer access-token-user-1",
  "X-Workspace-Id": "ws-1",
};

const AGENT_ROW = {
  id: "agent-1",
  profile_name: "Support",
  behavior: "Be helpful",
  tools: [],
  skills: [],
  auto_assign_conversation_labels: false,
  response_template_groups: [],
  handoff_topic_groups: [],
  handoff_notify_user_ids: [],
  context_groups: [],
  asset_groups: [],
};

const IMPORT_DRAFT: AgentKnowledgeImportDraft = {
  contextGroups: [
    {
      id: "ctx-g1",
      name: "Imported hours",
      facts: [{ id: "f1", title: "Hours", bodyText: "9am–5pm" }],
    },
  ],
  skills: [
    {
      id: "sk1",
      displayName: "Refund policy",
      description: "Handle refunds",
      content: "Steps for refunds",
    },
  ],
  templateGroups: [
    {
      id: "tg1",
      name: "FAQs",
      entries: [{ id: "e1", questionText: "Hours?", answerText: "9-5" }],
    },
  ],
};

beforeEach(async () => {
  vi.clearAllMocks();

  verifyTokenMock.mockImplementation((token) =>
    token === "access-token-user-1"
      ? Promise.resolve({ userId: "user-1" })
      : Promise.resolve(null),
  );
  validateWorkspaceMembershipMock.mockResolvedValue(true);
  getAgentConfigByIdMock.mockResolvedValue(AGENT_ROW);

  const { default: userRoute } = await import("../routes/user.js");
  app = new Hono().route("/", userRoute);
});

describe("POST /agents/:id/knowledge-import/preview", () => {
  // Multipart upload with a markdown file should extract text, call the LLM stub, and return a draft.
  it("returns draft after document extraction and generation", async () => {
    generateDraftMock.mockResolvedValue(IMPORT_DRAFT);

    const formData = new FormData();
    formData.append("profileName", "Support");
    formData.append("targets", JSON.stringify(["context"]));
    formData.append("focusHint", "business hours");
    formData.append(
      "files",
      new File(["# Hours\n9am–5pm"], "hours.md", { type: "text/markdown" }),
    );

    const res = await app.request("/agents/agent-1/knowledge-import/preview", {
      method: "POST",
      headers: AUTH,
      body: formData,
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.draft.contextGroups).toHaveLength(1);
    expect(body.draft.contextGroups[0].facts[0].bodyText).toBe("9am–5pm");
    expect(generateDraftMock).toHaveBeenCalledWith(
      expect.objectContaining({
        profileName: "Support",
        targets: ["context"],
        focusHint: "business hours",
        documents: expect.arrayContaining([
          expect.objectContaining({ name: "hours.md", text: expect.stringContaining("9am–5pm") }),
        ]),
      }),
    );
  });

  // Unknown agent id should short-circuit before preview processing.
  it("returns 404 agent_not_found when agent is missing", async () => {
    getAgentConfigByIdMock.mockResolvedValue(null);

    const formData = new FormData();
    formData.append("targets", JSON.stringify(["context"]));
    formData.append("files", new File(["x"], "doc.md", { type: "text/markdown" }));

    const res = await app.request("/agents/missing/knowledge-import/preview", {
      method: "POST",
      headers: AUTH,
      body: formData,
    });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("agent_not_found");
    expect(generateDraftMock).not.toHaveBeenCalled();
  });

  // Preview requires multipart so file uploads are parsed correctly.
  it("returns 415 multipart_required for JSON body", async () => {
    const res = await app.request("/agents/agent-1/knowledge-import/preview", {
      method: "POST",
      headers: { ...AUTH, "Content-Type": "application/json" },
      body: JSON.stringify({ targets: ["context"] }),
    });

    expect(res.status).toBe(415);
    const body = await res.json();
    expect(body.error).toBe("multipart_required");
  });
});

describe("POST /agents/:id/knowledge-import/apply", () => {
  // Apply should create workspace records and attach new ids to the agent config.
  it("persists draft items and updates agent attachments", async () => {
    createWorkspaceContextGroupMock.mockResolvedValue({ ok: true, id: "ctx-db-1", message: "ok" });
    addWorkspaceContextEntryMock.mockResolvedValue({ ok: true, message: "ok" });
    createWorkspaceSkillMock.mockResolvedValue({
      ok: true,
      skillId: "skill-db-1",
      message: "ok",
    });
    getWorkspaceSkillByIdMock.mockResolvedValue({
      id: "skill-db-1",
      skill_key: "refund-policy",
      display_name: "Refund policy",
      description: "Handle refunds",
      content_path: "skills/refund-policy.md",
      is_active: true,
      updated_at: "2026-01-01T00:00:00.000Z",
    });
    createWorkspaceResponseTemplateGroupMock.mockResolvedValue({
      ok: true,
      id: "tpl-db-1",
      message: "ok",
    });
    addWorkspaceResponseTemplateEntryMock.mockResolvedValue({ ok: true, message: "ok" });
    updateAgentConfigMock.mockResolvedValue({ ok: true, message: "ok" });

    const res = await app.request("/agents/agent-1/knowledge-import/apply", {
      method: "POST",
      headers: { ...AUTH, "Content-Type": "application/json" },
      body: JSON.stringify({ profileName: "Support", draft: IMPORT_DRAFT }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(createWorkspaceContextGroupMock).toHaveBeenCalledWith("ws-1", "Imported hours");
    expect(addWorkspaceContextEntryMock).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "ws-1",
        groupId: "ctx-db-1",
        title: "Hours",
        bodyText: "9am–5pm",
      }),
    );
    expect(createWorkspaceSkillMock).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "ws-1",
        displayName: "Refund policy",
      }),
    );
    expect(createWorkspaceResponseTemplateGroupMock).toHaveBeenCalledWith("ws-1", "FAQs");
    expect(updateAgentConfigMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "agent-1",
        workspace_id: "ws-1",
        context_groups: ["ctx-db-1"],
        skills: ["refund-policy"],
        response_template_groups: ["tpl-db-1"],
      }),
    );
  });

  // Invalid apply payload should be rejected before repositories run.
  it("returns 400 import_apply_failed for invalid draft payload", async () => {
    const res = await app.request("/agents/agent-1/knowledge-import/apply", {
      method: "POST",
      headers: { ...AUTH, "Content-Type": "application/json" },
      body: JSON.stringify({ profileName: "Support", draft: { contextGroups: [] } }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("import_apply_failed");
    expect(updateAgentConfigMock).not.toHaveBeenCalled();
  });
});
