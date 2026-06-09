import { describe, it, expect } from "vitest";
import type {
  AgentConfigRecord,
  AgentToolDefinitionRecord,
  WorkspaceContextGroupSummary,
  WorkspaceResponseTemplateGroupSummary,
  WorkspaceSkillDefinitionRecord,
} from "@/types/repositories";

const { buildAgentConfigFormBaseline, readAgentConfigFormSnapshot, agentConfigFormSnapshotsEqual, agentProfileNameDirty, agentProfileBehaviorDirty } =
  await import("@/lib/agent-config-form-snapshot");

describe("useAgentConfigFormDirty helpers", () => {
  const agent: AgentConfigRecord = {
    id: "a1",
    profile_name: "My Agent",
    behavior: "Be helpful",
    tools: ["tool_a"],
    skills: ["skill_a"],
    response_template_groups: ["rt1"],
    context_groups: ["ctx1"],
    asset_groups: [],
    handoff_topic_groups: [],
    auto_assign_conversation_labels: true,
  };
  const tool: AgentToolDefinitionRecord = { tool_key: "tool_a", scope: "configurable" };
  const skill: WorkspaceSkillDefinitionRecord = { skill_key: "skill_a" };
  const rtGroup: WorkspaceResponseTemplateGroupSummary = { id: "rt1" };
  const ctxGroup: WorkspaceContextGroupSummary = { id: "ctx1" };

  it("agentProfileNameDirty returns true when field differs from baseline", () => {
    const baseline = buildAgentConfigFormBaseline({
      agent,
      connections: [],
      availableTools: [tool],
      availableSkills: [skill],
      responseTemplateGroups: [rtGroup],
      workspaceContextGroups: [ctxGroup],
      workspaceAssetGroups: [],
      handoffTopicGroups: [],
    });
    const changed = { ...baseline, profileName: "Different Name" };
    expect(agentProfileNameDirty(baseline, changed)).toBe(true);
  });

  it("agentProfileNameDirty returns false when field matches baseline", () => {
    const baseline = buildAgentConfigFormBaseline({
      agent,
      connections: [],
      availableTools: [tool],
      availableSkills: [skill],
      responseTemplateGroups: [rtGroup],
      workspaceContextGroups: [ctxGroup],
      workspaceAssetGroups: [],
      handoffTopicGroups: [],
    });
    expect(agentProfileNameDirty(baseline, { ...baseline })).toBe(false);
  });

  it("agentProfileBehaviorDirty returns true when behavior differs", () => {
    const baseline = buildAgentConfigFormBaseline({
      agent,
      connections: [],
      availableTools: [tool],
      availableSkills: [skill],
      responseTemplateGroups: [rtGroup],
      workspaceContextGroups: [ctxGroup],
      workspaceAssetGroups: [],
      handoffTopicGroups: [],
    });
    const changed = { ...baseline, behavior: "Changed" };
    expect(agentProfileBehaviorDirty(baseline, changed)).toBe(true);
  });
});
