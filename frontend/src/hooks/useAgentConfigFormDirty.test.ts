import { describe, it, expect } from "vitest";
import type {
  AgentConfigRecord,
  WorkspaceCustomToolListItem,
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
    handoff_notify_user_ids: [],
    auto_assign_conversation_labels: true,
  };
  const tool: WorkspaceCustomToolListItem = {
    id: "t1",
    workspace_id: "ws1",
    tool_key: "tool_a",
    display_name: "Tool A",
    description: "",
    required_env: [],
    is_active: true,
    source_hash: "abc",
    created_at: "",
    updated_at: "",
  };
  const skill: WorkspaceSkillDefinitionRecord = { skill_key: "skill_a" };
  const rtGroup: WorkspaceResponseTemplateGroupSummary = { id: "rt1" };
  const ctxGroup: WorkspaceContextGroupSummary = { id: "ctx1" };

  // Verifies that agentProfileNameDirty detects when the profile name has changed from baseline.
  // Enables the inline Save button next to the agent name field when the user edits it.
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

  // Confirms agentProfileNameDirty returns false when profile name matches the baseline exactly.
  // Prevents showing a stale Save button when no actual changes have been made to the name.
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

  // Verifies that agentProfileBehaviorDirty detects when the behavior text has changed from baseline.
  // Enables the inline Save button next to the agent behavior field so users can persist edits.
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
