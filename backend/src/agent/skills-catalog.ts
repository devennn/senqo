import { getAgentConfigById } from "../repositories/agent.js";
import {
  listHandoffTopicsForInstructions,
  type HandoffTopicGroupForInstructions,
} from "../repositories/handoff-topic-groups.js";
import {
  listResponseTemplatesForInstructions,
  type ResponseTemplateGroupForInstructions,
} from "../repositories/response-templates.js";
import {
  listWorkspaceContextForInstructions,
  type ContextGroupForInstructions,
} from "../repositories/workspace-context-groups.js";
import { listConversationLabels } from "../repositories/conversation-labels.js";
import { listWorkspaceAssetsForInstructions } from "../repositories/workspace-asset-groups.js";
import {
  findWorkspaceSkillByNameOrKey,
  listActiveWorkspaceSkills,
  readWorkspaceSkillContent,
} from "../repositories/skills.js";
import type { LoadSkillResult, SkillSummary } from "../types/agent.js";
import {
  buildAgentSystemPrompt,
  DEFAULT_TOOL_KEYS,
  resolveEnabledToolKeys,
} from "./system-prompt.js";

export async function listSkillSummaries(workspaceId: string): Promise<SkillSummary[]> {
  const skills = await listActiveWorkspaceSkills(workspaceId);
  return skills.map((skill) => ({
    id: skill.id,
    skillKey: skill.skill_key,
    name: skill.display_name,
    description: skill.description || "No description provided.",
  }));
}

export async function loadSkillByName(
  workspaceId: string,
  skillName: string,
): Promise<LoadSkillResult> {
  const normalized = skillName.trim();
  if (!normalized) {
    return { ok: false, error: "skill_name is required." };
  }

  const matched = await findWorkspaceSkillByNameOrKey(workspaceId, normalized);
  if (!matched) {
    return { ok: false, error: `Skill not found: ${skillName}` };
  }

  const content = await readWorkspaceSkillContent(workspaceId, matched.storage_path);
  if (!content) {
    return { ok: false, error: `Unable to load skill content: ${skillName}` };
  }
  return { ok: true, content };
}

function formatGroupedResponseTemplates(groups: ResponseTemplateGroupForInstructions[]): string {
  if (groups.length === 0) return "";
  const chunks: string[] = [
    "These groups and entries are embedded in this system message for this agent (not loaded via a tool).",
    "---",
  ];

  for (const grp of groups) {
    chunks.push(`#### ${grp.name}`);
    grp.entries.forEach((entry, i) => {
      chunks.push(
        `[${i + 1}] Typical question intent:\n${entry.question_text}`,
        `Answer:\n${entry.answer_text}`,
      );
      chunks.push("---");
    });
  }

  return chunks.filter((s) => s.trim().length > 0).join("\n\n");
}

async function formatConversationLabelsInstruction(workspaceId: string): Promise<string> {
  const labels = await listConversationLabels(workspaceId);
  if (labels.length === 0) return "";
  const lines = labels.map(
    (l) =>
      `- ${l.id}: "${l.name}" — ${l.description.trim().length > 0 ? l.description.trim() : "(no description)"}`,
  );
  return [
    "Classify this chat when it clearly matches; use exact UUIDs in `apply_conversation_labels`:",
    ...lines,
    "Call `apply_conversation_labels` with the matching labelIds (or [] to clear AI-assigned labels only). User-applied labels in the dashboard are never removed by this tool.",
  ].join("\n");
}

function formatGroupedWorkspaceContext(groups: ContextGroupForInstructions[]): string {
  if (groups.length === 0) return "";
  const chunks: string[] = [
    "Treat entries as stable workspace facts. When response templates cover the same topic, use the template Answer exactly and do not contradict them.",
    "---",
  ];

  for (const grp of groups) {
    chunks.push(`#### ${grp.name}`);
    grp.entries.forEach((entry, i) => {
      chunks.push(`[${i + 1}] ${entry.title}`, entry.body_text, "---");
    });
  }

  return chunks.filter((s) => s.trim().length > 0).join("\n\n");
}

function formatHandoffTopicsInstruction(groups: HandoffTopicGroupForInstructions[]): string {
  if (groups.length === 0) return "";
  const chunks: string[] = [
    "When the customer's message clearly matches a topic below, call `handoff_to_human` and pass a short `reason` that names the topic. This reason is shown to teammates in conversation history. Do not continue with normal resolution once a handoff is appropriate.",
    "---",
  ];

  for (const grp of groups) {
    chunks.push(`#### ${grp.name}`);
    grp.entries.forEach((e) => {
      const desc =
        e.description.trim().length > 0 ? e.description.trim() : "(no extra detail)";
      chunks.push(`- "${e.topic.trim()}" — ${desc}`);
    });
    chunks.push("---");
  }

  return chunks.filter((s) => s.trim().length > 0).join("\n\n");
}

function emptyAgentSystemPromptInput(dryRun: boolean): Parameters<typeof buildAgentSystemPrompt>[0] {
  return {
    dryRun,
    enabledToolKeys: [...DEFAULT_TOOL_KEYS],
    workspaceContext: "",
    responseTemplates: "",
    handoffTopics: "",
    conversationLabels: "",
    assetGroups: [],
    profileName: "",
    behavior: "",
  };
}

export async function buildAgentInstructions(
  workspaceId: string,
  agentConfigId?: string,
  dryRun = false,
): Promise<string> {
  if (!agentConfigId) {
    return buildAgentSystemPrompt(emptyAgentSystemPromptInput(dryRun));
  }

  const activeConfig = await getAgentConfigById(workspaceId, agentConfigId);
  if (!activeConfig) {
    return buildAgentSystemPrompt(emptyAgentSystemPromptInput(dryRun));
  }

  const contextGroupIds = activeConfig.context_groups ?? [];
  const groupedContext = await listWorkspaceContextForInstructions(workspaceId, contextGroupIds);
  const workspaceContext = formatGroupedWorkspaceContext(groupedContext);

  const groupIds = activeConfig.response_template_groups ?? [];
  const groupedTemplates = await listResponseTemplatesForInstructions(workspaceId, groupIds);
  const responseTemplates = formatGroupedResponseTemplates(groupedTemplates);

  const handoffGroupIds = activeConfig.handoff_topic_groups ?? [];
  const handoffGrouped = await listHandoffTopicsForInstructions(workspaceId, handoffGroupIds);
  const handoffTopics = formatHandoffTopicsInstruction(handoffGrouped);

  let conversationLabels = "";
  if (activeConfig.auto_assign_conversation_labels) {
    conversationLabels = await formatConversationLabelsInstruction(workspaceId);
  }

  const assetGroupRows = await listWorkspaceAssetsForInstructions(
    workspaceId,
    activeConfig.asset_groups ?? [],
  );
  const assetGroups = assetGroupRows.map((grp) => ({
    name: grp.name,
    assets: grp.assets.map((row) => ({
      fileName: row.file_name,
      description: row.description,
    })),
  }));

  return buildAgentSystemPrompt({
    dryRun,
    enabledToolKeys: resolveEnabledToolKeys(activeConfig.tools),
    workspaceContext,
    responseTemplates,
    handoffTopics,
    conversationLabels,
    assetGroups,
    profileName: activeConfig.profile_name,
    behavior: activeConfig.behavior,
  });
}
