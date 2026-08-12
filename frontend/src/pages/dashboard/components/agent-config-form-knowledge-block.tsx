import { AgentConfigKnowledgeCapabilityFields } from "@/pages/dashboard/components/agent-config-knowledge-capability-fields";
import type { AgentConfigFormSectionDirtyState, AgentConfigKnowledgeCapabilityFieldsProps } from "@/types/ui";
import type { AgentConfigRecord } from "@/types/repositories";

type Props = {
  agent: AgentConfigRecord;
  sectionDirty: AgentConfigFormSectionDirtyState;
  saving: boolean;
  wsPath: (path: string) => string;
} & Pick<
  AgentConfigKnowledgeCapabilityFieldsProps,
  | "availableTools"
  | "availableSkills"
  | "responseTemplateGroups"
  | "workspaceContextGroups"
  | "workspaceAssetGroups"
  | "handoffTopicGroups"
>;

function agentTabHref(wsPath: (path: string) => string, agentId: string, tab: string): string {
  const params = new URLSearchParams();
  params.set("tab", tab);
  params.set("agentId", agentId);
  return `${wsPath("/agent")}?${params.toString()}`;
}

function knowledgeTabHref(wsPath: (path: string) => string, tab: string): string {
  const params = new URLSearchParams();
  params.set("tab", tab);
  return `${wsPath("/knowledge")}?${params.toString()}`;
}

export function AgentConfigFormKnowledgeBlock({
  agent,
  sectionDirty,
  saving,
  wsPath,
  ...lists
}: Props) {
  return (
    <AgentConfigKnowledgeCapabilityFields
      {...lists}
      selectedTools={new Set(Array.isArray(agent.tools) ? agent.tools : [])}
      selectedSkills={new Set(Array.isArray(agent.skills) ? agent.skills : [])}
      selectedResponseTemplateGroups={new Set(Array.isArray(agent.response_template_groups) ? agent.response_template_groups : [])}
      selectedContextGroups={new Set(Array.isArray(agent.context_groups) ? agent.context_groups : [])}
      selectedAssetGroups={new Set(Array.isArray(agent.asset_groups) ? agent.asset_groups : [])}
      selectedHandoffTopicGroups={new Set(
        Array.isArray(agent.handoff_topic_groups) ? agent.handoff_topic_groups : [],
      )}
      templatesTabHref={knowledgeTabHref(wsPath, "templates")}
      contextTabHref={knowledgeTabHref(wsPath, "context")}
      assetsTabHref={agentTabHref(wsPath, agent.id, "assets")}
      handoffTabHref={knowledgeTabHref(wsPath, "handoff")}
      toolsTabHref={agentTabHref(wsPath, agent.id, "tools")}
      workspaceContextDirty={sectionDirty.workspaceContext}
      assetGroupsDirty={sectionDirty.assetGroups}
      responseTemplatesDirty={sectionDirty.responseTemplates}
      handoffTopicsDirty={sectionDirty.handoffTopics}
      toolsDirty={sectionDirty.tools}
      skillsDirty={sectionDirty.skills}
      saving={saving}
    />
  );
}
