import type {
  AgentConfigRecord,
  WorkspaceCustomToolListItem,
  WorkspaceAssetGroupSummary,
  WorkspaceContextGroupSummary,
  WorkspaceHandoffTopicGroupSummary,
  WorkspaceResponseTemplateGroupSummary,
  WorkspaceSkillDefinitionRecord,
} from "@/types/repositories";
import type { AgentConfigConnectionOption, AgentConfigFormNormalizedSnapshot } from "@/types/ui";

function sortedCopy(values: string[]): readonly string[] {
  return [...values].sort((a, b) => a.localeCompare(b));
}

function stringArraysEqual(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

export function agentProfileNameDirty(
  baseline: AgentConfigFormNormalizedSnapshot,
  current: AgentConfigFormNormalizedSnapshot,
): boolean {
  return current.profileName !== baseline.profileName;
}

export function agentProfileBehaviorDirty(
  baseline: AgentConfigFormNormalizedSnapshot,
  current: AgentConfigFormNormalizedSnapshot,
): boolean {
  return current.behavior !== baseline.behavior;
}

export function agentConnectionSectionDirty(
  baseline: AgentConfigFormNormalizedSnapshot,
  current: AgentConfigFormNormalizedSnapshot,
): boolean {
  return !stringArraysEqual(
    sortedCopy([...current.attachedConnectionIds]),
    sortedCopy([...baseline.attachedConnectionIds]),
  );
}

export function agentWorkspaceContextGroupsDirty(
  baseline: AgentConfigFormNormalizedSnapshot,
  current: AgentConfigFormNormalizedSnapshot,
): boolean {
  return !stringArraysEqual(current.workspaceContextGroups, baseline.workspaceContextGroups);
}

export function agentResponseTemplateGroupsDirty(
  baseline: AgentConfigFormNormalizedSnapshot,
  current: AgentConfigFormNormalizedSnapshot,
): boolean {
  return !stringArraysEqual(current.responseTemplateGroups, baseline.responseTemplateGroups);
}

export function agentAssetGroupsDirty(
  baseline: AgentConfigFormNormalizedSnapshot,
  current: AgentConfigFormNormalizedSnapshot,
): boolean {
  return !stringArraysEqual(current.assetGroups, baseline.assetGroups);
}

export function agentHandoffTopicGroupsDirty(
  baseline: AgentConfigFormNormalizedSnapshot,
  current: AgentConfigFormNormalizedSnapshot,
): boolean {
  return !stringArraysEqual(current.handoffTopicGroups, baseline.handoffTopicGroups);
}

export function agentToolsDirty(
  baseline: AgentConfigFormNormalizedSnapshot,
  current: AgentConfigFormNormalizedSnapshot,
): boolean {
  return !stringArraysEqual(current.tools, baseline.tools);
}

export function agentSkillsDirty(
  baseline: AgentConfigFormNormalizedSnapshot,
  current: AgentConfigFormNormalizedSnapshot,
): boolean {
  return !stringArraysEqual(current.skills, baseline.skills);
}

export function agentAutoAssignSectionDirty(
  baseline: AgentConfigFormNormalizedSnapshot,
  current: AgentConfigFormNormalizedSnapshot,
): boolean {
  return current.autoAssignConversationLabels !== baseline.autoAssignConversationLabels;
}

export function buildAgentConfigFormBaseline(input: {
  agent: AgentConfigRecord;
  connections: AgentConfigConnectionOption[];
  availableTools: WorkspaceCustomToolListItem[];
  availableSkills: WorkspaceSkillDefinitionRecord[];
  responseTemplateGroups: WorkspaceResponseTemplateGroupSummary[];
  workspaceContextGroups: WorkspaceContextGroupSummary[];
  workspaceAssetGroups: WorkspaceAssetGroupSummary[];
  handoffTopicGroups: WorkspaceHandoffTopicGroupSummary[];
}): AgentConfigFormNormalizedSnapshot {
  const configurableToolKeys = new Set(input.availableTools.map((t) => t.tool_key));
  const skillKeys = new Set(input.availableSkills.map((s) => s.skill_key));
  const templateGroupIds = new Set(input.responseTemplateGroups.map((g) => g.id));
  const contextGroupIds = new Set(input.workspaceContextGroups.map((g) => g.id));
  const assetGroupIds = new Set(input.workspaceAssetGroups.map((g) => g.id));
  const handoffGroupIds = new Set(input.handoffTopicGroups.map((g) => g.id));
  const attachedConnectionIds = sortedCopy(
    input.connections
      .filter((connection) => connection.attachedAgentId === input.agent.id)
      .map((connection) => connection.id),
  );
  const toolsSorted = sortedCopy(
    (input.agent.tools ?? []).filter((key) => configurableToolKeys.has(key)),
  );
  const skillsSorted = sortedCopy(
    (input.agent.skills ?? []).filter((key) => skillKeys.has(key)),
  );
  const groupsSorted = sortedCopy(
    (input.agent.response_template_groups ?? []).filter((id) => templateGroupIds.has(id)),
  );
  const contextSorted = sortedCopy(
    (input.agent.context_groups ?? []).filter((id) => contextGroupIds.has(id)),
  );
  const assetSorted = sortedCopy(
    (input.agent.asset_groups ?? []).filter((id) => assetGroupIds.has(id)),
  );
  const handoffSorted = sortedCopy(
    (input.agent.handoff_topic_groups ?? []).filter((id) => handoffGroupIds.has(id)),
  );
  return {
    profileName: String(input.agent.profile_name ?? "").trim(),
    behavior: String(input.agent.behavior ?? "").trim(),
    tools: toolsSorted,
    skills: skillsSorted,
    responseTemplateGroups: groupsSorted,
    workspaceContextGroups: contextSorted,
    assetGroups: assetSorted,
    handoffTopicGroups: handoffSorted,
    handoffNotifyUserIds: sortedCopy(input.agent.handoff_notify_user_ids ?? []),
    attachedConnectionIds,
    autoAssignConversationLabels: input.agent.auto_assign_conversation_labels !== false,
  };
}

export function readAgentConfigFormSnapshot(form: HTMLFormElement): AgentConfigFormNormalizedSnapshot {
  const fd = new FormData(form);
  return {
    profileName: String(fd.get("profileName") ?? "").trim(),
    behavior: String(fd.get("behavior") ?? "").trim(),
    tools: sortedCopy(fd.getAll("tools").map(String)),
    skills: sortedCopy(fd.getAll("skills").map(String)),
    responseTemplateGroups: sortedCopy(fd.getAll("responseTemplateGroups").map(String)),
    workspaceContextGroups: sortedCopy(fd.getAll("contextGroups").map(String)),
    assetGroups: sortedCopy(fd.getAll("assetGroups").map(String)),
    handoffTopicGroups: sortedCopy(fd.getAll("handoffTopicGroups").map(String)),
    handoffNotifyUserIds: sortedCopy(fd.getAll("handoffNotifyUserIds").map(String)),
    attachedConnectionIds: sortedCopy(fd.getAll("attachedConnectionIds").map(String)),
    autoAssignConversationLabels: fd.get("autoAssignConversationLabels") === "on",
  };
}

export function agentConfigFormSnapshotsEqual(
  a: AgentConfigFormNormalizedSnapshot,
  b: AgentConfigFormNormalizedSnapshot,
): boolean {
  return (
    a.profileName === b.profileName &&
    a.behavior === b.behavior &&
    a.autoAssignConversationLabels === b.autoAssignConversationLabels &&
    stringArraysEqual(a.attachedConnectionIds, b.attachedConnectionIds) &&
    stringArraysEqual(a.tools, b.tools) &&
    stringArraysEqual(a.skills, b.skills) &&
    stringArraysEqual(a.responseTemplateGroups, b.responseTemplateGroups) &&
    stringArraysEqual(a.workspaceContextGroups, b.workspaceContextGroups) &&
    stringArraysEqual(a.assetGroups, b.assetGroups) &&
    stringArraysEqual(a.handoffTopicGroups, b.handoffTopicGroups)
  );
}
