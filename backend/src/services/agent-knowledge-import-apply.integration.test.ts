import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../repositories/agent.js", () => ({
  getAgentConfigById: vi.fn(),
  updateAgentConfig: vi.fn(),
}));

vi.mock("../repositories/workspace-context-groups.js", () => ({
  createWorkspaceContextGroup: vi.fn(),
  addWorkspaceContextEntry: vi.fn(),
}));

vi.mock("../repositories/response-templates.js", () => ({
  createWorkspaceResponseTemplateGroup: vi.fn(),
  addWorkspaceResponseTemplateEntry: vi.fn(),
}));

vi.mock("../repositories/skills.js", () => ({
  createWorkspaceSkill: vi.fn(),
  getWorkspaceSkillById: vi.fn(),
}));

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
import { applyAgentKnowledgeImport } from "./agent-knowledge-import-apply.js";

const getAgentConfigByIdMock = vi.mocked(getAgentConfigById);
const updateAgentConfigMock = vi.mocked(updateAgentConfig);
const createWorkspaceContextGroupMock = vi.mocked(createWorkspaceContextGroup);
const addWorkspaceContextEntryMock = vi.mocked(addWorkspaceContextEntry);
const createWorkspaceSkillMock = vi.mocked(createWorkspaceSkill);
const getWorkspaceSkillByIdMock = vi.mocked(getWorkspaceSkillById);
const createWorkspaceResponseTemplateGroupMock = vi.mocked(createWorkspaceResponseTemplateGroup);
const addWorkspaceResponseTemplateEntryMock = vi.mocked(addWorkspaceResponseTemplateEntry);

const AGENT_ROW = {
  id: "agent-1",
  profile_name: "Support",
  behavior: "Be helpful",
  tools: [],
  skills: ["existing-skill"],
  auto_assign_conversation_labels: false,
  response_template_groups: ["tpl-existing"],
  handoff_topic_groups: [],
  handoff_notify_user_ids: [],
  context_groups: ["ctx-existing"],
  asset_groups: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  getAgentConfigByIdMock.mockResolvedValue(AGENT_ROW);
});

describe("applyAgentKnowledgeImport", () => {
  // Service should merge new group ids with existing agent attachments without duplicates.
  it("creates draft entities and merges ids into agent config", async () => {
    createWorkspaceContextGroupMock.mockResolvedValue({ ok: true, id: "ctx-new", message: "ok" });
    addWorkspaceContextEntryMock.mockResolvedValue({ ok: true, message: "ok" });
    createWorkspaceSkillMock.mockResolvedValue({ ok: true, skillId: "skill-new", message: "ok" });
    getWorkspaceSkillByIdMock.mockResolvedValue({
      id: "skill-new",
      skill_key: "new-skill",
      display_name: "New skill",
      description: "Desc",
      content_path: "skills/new-skill.md",
      is_active: true,
      updated_at: "2026-01-01T00:00:00.000Z",
    });
    createWorkspaceResponseTemplateGroupMock.mockResolvedValue({
      ok: true,
      id: "tpl-new",
      message: "ok",
    });
    addWorkspaceResponseTemplateEntryMock.mockResolvedValue({ ok: true, message: "ok" });
    updateAgentConfigMock.mockResolvedValue({ ok: true, message: "ok" });

    const result = await applyAgentKnowledgeImport({
      workspaceId: "ws-1",
      agentId: "agent-1",
      draft: {
        contextGroups: [
          {
            id: "g1",
            name: "Policies",
            facts: [{ id: "f1", title: "Returns", bodyText: "30 days" }],
          },
        ],
        skills: [
          {
            id: "s1",
            displayName: "New skill",
            description: "Desc",
            content: "Body",
          },
        ],
        templateGroups: [
          {
            id: "t1",
            name: "Replies",
            entries: [{ id: "e1", questionText: "Q", answerText: "A" }],
          },
        ],
      },
    });

    expect(result).toEqual({
      ok: true,
      workspaceRefs: { contextGroups: { g1: "ctx-new" }, templateGroups: { t1: "tpl-new" } },
    });
    expect(updateAgentConfigMock).toHaveBeenCalledWith(
      expect.objectContaining({
        context_groups: ["ctx-existing", "ctx-new"],
        skills: ["existing-skill", "new-skill"],
        response_template_groups: ["tpl-existing", "tpl-new"],
      }),
    );
  });

  // Missing agent should fail before any workspace writes.
  it("returns agent not found when config is missing", async () => {
    getAgentConfigByIdMock.mockResolvedValue(null);

    const result = await applyAgentKnowledgeImport({
      workspaceId: "ws-1",
      agentId: "missing",
      draft: { contextGroups: [], skills: [], templateGroups: [] },
    });

    expect(result).toEqual({ ok: false, message: "Agent not found." });
    expect(createWorkspaceContextGroupMock).not.toHaveBeenCalled();
    expect(updateAgentConfigMock).not.toHaveBeenCalled();
  });
});
