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
import type {
  AgentKnowledgeImportDraft,
  AgentKnowledgeImportWorkspaceRefs,
} from "../types/agent-knowledge-import.js";

const scope = "AgentKnowledgeImportApply";

function emptyWorkspaceRefs(): AgentKnowledgeImportWorkspaceRefs {
  return { contextGroups: {}, templateGroups: {} };
}

export async function applyAgentKnowledgeImport(input: {
  workspaceId: string;
  agentId: string;
  draft: AgentKnowledgeImportDraft;
  workspaceRefs?: AgentKnowledgeImportWorkspaceRefs;
}): Promise<
  { ok: true; workspaceRefs: AgentKnowledgeImportWorkspaceRefs } | { ok: false; message: string }
> {
  try {
    const agent = await getAgentConfigById(input.workspaceId, input.agentId);
    if (!agent) {
      console.warn(`[${scope}/apply] Failed query: agent not found agentId=${input.agentId}`);
      return { ok: false, message: "Agent not found." };
    }

    const contextGroupIds = [...agent.context_groups];
    const templateGroupIds = [...agent.response_template_groups];
    const skillKeys = [...agent.skills];
    const workspaceRefs: AgentKnowledgeImportWorkspaceRefs = {
      contextGroups: { ...(input.workspaceRefs?.contextGroups ?? {}) },
      templateGroups: { ...(input.workspaceRefs?.templateGroups ?? {}) },
    };

    for (const group of input.draft.contextGroups) {
      let workspaceGroupId = workspaceRefs.contextGroups[group.id];
      if (!workspaceGroupId) {
        const created = await createWorkspaceContextGroup(input.workspaceId, group.name.trim());
        if (!created.ok) {
          console.warn(`[${scope}/apply] Failed query: ${created.message}`);
          return { ok: false, message: created.message };
        }
        workspaceGroupId = created.id;
        workspaceRefs.contextGroups[group.id] = workspaceGroupId;
        if (!contextGroupIds.includes(workspaceGroupId)) {
          contextGroupIds.push(workspaceGroupId);
        }
      }

      for (const fact of group.facts) {
        const entry = await addWorkspaceContextEntry({
          workspaceId: input.workspaceId,
          groupId: workspaceGroupId,
          title: fact.title,
          bodyText: fact.bodyText,
        });
        if (!entry.ok) {
          console.warn(`[${scope}/apply] Failed query: ${entry.message}`);
          return { ok: false, message: entry.message };
        }
      }
    }

    for (const skill of input.draft.skills) {
      const created = await createWorkspaceSkill({
        workspaceId: input.workspaceId,
        displayName: skill.displayName,
        description: skill.description,
        content: skill.content,
      });
      if (!created.ok || !created.skillId) {
        console.warn(`[${scope}/apply] Failed query: ${created.message}`);
        return { ok: false, message: created.message };
      }
      const row = await getWorkspaceSkillById(input.workspaceId, created.skillId);
      if (row && !skillKeys.includes(row.skill_key)) {
        skillKeys.push(row.skill_key);
      }
    }

    for (const group of input.draft.templateGroups) {
      let workspaceGroupId = workspaceRefs.templateGroups[group.id];
      if (!workspaceGroupId) {
        const created = await createWorkspaceResponseTemplateGroup(input.workspaceId, group.name.trim());
        if (!created.ok) {
          console.warn(`[${scope}/apply] Failed query: ${created.message}`);
          return { ok: false, message: created.message };
        }
        workspaceGroupId = created.id;
        workspaceRefs.templateGroups[group.id] = workspaceGroupId;
        if (!templateGroupIds.includes(workspaceGroupId)) {
          templateGroupIds.push(workspaceGroupId);
        }
      }

      for (const entry of group.entries) {
        const row = await addWorkspaceResponseTemplateEntry({
          workspaceId: input.workspaceId,
          groupId: workspaceGroupId,
          questionText: entry.questionText,
          answerText: entry.answerText,
        });
        if (!row.ok) {
          console.warn(`[${scope}/apply] Failed query: ${row.message}`);
          return { ok: false, message: row.message };
        }
      }
    }

    const saved = await updateAgentConfig({
      id: agent.id,
      workspace_id: input.workspaceId,
      profile_name: agent.profile_name,
      behavior: agent.behavior,
      tools: agent.tools,
      skills: skillKeys,
      auto_assign_conversation_labels: agent.auto_assign_conversation_labels,
      response_template_groups: templateGroupIds,
      handoff_topic_groups: agent.handoff_topic_groups,
      context_groups: contextGroupIds,
      asset_groups: agent.asset_groups,
    });

    if (!saved.ok) {
      console.warn(`[${scope}/apply] Failed query: ${saved.message}`);
      return { ok: false, message: saved.message };
    }

    console.info(`[${scope}/apply] Success: agentId=${input.agentId}`);
    return { ok: true, workspaceRefs };
  } catch (error) {
    console.error(`[${scope}/apply] Unexpected error: ${String(error)}`);
    return { ok: false, message: "Could not save import." };
  }
}

export { emptyWorkspaceRefs };
