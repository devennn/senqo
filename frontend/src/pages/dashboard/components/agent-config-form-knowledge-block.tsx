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

function tabHref(wsPath: (path: string) => string, agentId: string, tab: string): string {
  const params = new URLSearchParams();
  params.set("tab", tab);
  params.set("agentId", agentId);
  return `${wsPath("/agent")}?${params.toString()}`;
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
      templatesTabHref={tabHref(wsPath, agent.id, "templates")}
      contextTabHref={tabHref(wsPath, agent.id, "context")}
      assetsTabHref={tabHref(wsPath, agent.id, "assets")}
      handoffTabHref={tabHref(wsPath, agent.id, "handoff")}
      toolsTabHref={tabHref(wsPath, agent.id, "tools")}
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
