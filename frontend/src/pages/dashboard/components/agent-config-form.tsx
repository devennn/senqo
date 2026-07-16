import { useState, type FormEvent } from "react";
import { useAgentConfigFormDirty } from "@/hooks/useAgentConfigFormDirty";
import { useTransientBooleanReset } from "@/hooks/useTransientBooleanReset";
import { TRANSIENT_SUCCESS_FEEDBACK_MS } from "@/lib/transient-feedback";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Bot } from "lucide-react";
import { api } from "@/lib/api";
import { AgentConnectionAttachFields } from "@/pages/dashboard/components/agent-connection-attach-fields";
import { AgentConfigFormAutoAssignLabelsField } from "@/pages/dashboard/components/agent-config-form-auto-assign-labels-field";
import { AgentConfigKnowledgeCapabilityFields } from "@/pages/dashboard/components/agent-config-knowledge-capability-fields";
import { AgentProfileBehaviorFields } from "@/pages/dashboard/components/agent-profile-behavior-fields";
import { useWorkspace } from "@/context/workspace";
import type { AgentConfigFormProps } from "@/types/ui";

function agentTabHref(wsPath: (path: string) => string, agentId: string, tab: string): string {
  const params = new URLSearchParams();
  params.set("tab", tab);
  params.set("agentId", agentId);
  return `${wsPath("/agent")}?${params.toString()}`;
}

export function AgentConfigForm({
  agent,
  connections,
  availableTools,
  availableSkills,
  responseTemplateGroups,
  workspaceContextGroups,
  workspaceAssetGroups,
  handoffTopicGroups,
  onSaved,
}: AgentConfigFormProps) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const { wsPath } = useWorkspace();
  const { formRef, sectionDirty, formBaselineProps } = useAgentConfigFormDirty({
    agent,
    connections,
    availableTools,
    availableSkills,
    responseTemplateGroups,
    workspaceContextGroups,
    workspaceAssetGroups,
    handoffTopicGroups,
  });
  const selectedTools = new Set(Array.isArray(agent.tools) ? agent.tools : []);
  const selectedSkills = new Set(Array.isArray(agent.skills) ? agent.skills : []);
  const selectedResponseTemplateGroups = new Set(Array.isArray(agent.response_template_groups) ? agent.response_template_groups : []);
  const selectedHandoffTopicGroups = new Set(Array.isArray(agent.handoff_topic_groups) ? agent.handoff_topic_groups : []);
  const selectedContextGroups = new Set(Array.isArray(agent.context_groups) ? agent.context_groups : []);
  const selectedAssetGroups = new Set(Array.isArray(agent.asset_groups) ? agent.asset_groups : []);
  useTransientBooleanReset(saved, setSaved, TRANSIENT_SUCCESS_FEEDBACK_MS);
  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setSaving(true);
    setSaved(false);
    setSaveError(null);

    try {
      const fd = new FormData(e.currentTarget);
      const tools = fd.getAll("tools").map(String);
      const skills = fd.getAll("skills").map(String);
      await api.put(`/api/user/agents/${agent.id}`, {
        profileName: String(fd.get("profileName") ?? ""),
        behavior: String(fd.get("behavior") ?? ""),
        tools,
        skills,
        responseTemplateGroups: fd.getAll("responseTemplateGroups").map(String),
        contextGroups: fd.getAll("contextGroups").map(String),
        assetGroups: fd.getAll("assetGroups").map(String),
        handoffTopicGroups: fd.getAll("handoffTopicGroups").map(String),
        attachedConnectionIds: fd.getAll("attachedConnectionIds").map(String),
        autoAssignConversationLabels: fd.get("autoAssignConversationLabels") === "on",
      });
      setSaved(true);
      onSaved?.();
    } catch (submitError) {
      setSaved(false);
      setSaveError(submitError instanceof Error ? submitError.message : "Could not save agent.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bot className="size-5 text-primary" />
          Agent Profile & Behavior
        </CardTitle>
        <CardDescription>
          Configure how your AI agent responds to customers. A Save button appears next to what you changed
          (same style as Create New Agent).
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          ref={formRef}
          onSubmit={(e) => { void handleSubmit(e); }}
          className="space-y-5"
          {...formBaselineProps}
        >
          <input type="hidden" name="agentId" value={agent.id} />
          <AgentProfileBehaviorFields
            agent={agent}
            profileNameDirty={sectionDirty.profileName}
            profileBehaviorDirty={sectionDirty.profileBehavior}
            saving={saving}
          />
          <AgentConnectionAttachFields
            key={`${agent.id}:${connections
              .filter((c) => c.attachedAgentId === agent.id)
              .map((c) => c.id)
              .sort()
              .join(",")}`}
            connections={connections}
            agentId={agent.id}
            sectionDirty={sectionDirty.connection}
            saving={saving}
          />
          <AgentConfigKnowledgeCapabilityFields
            availableTools={availableTools}
            availableSkills={availableSkills}
            responseTemplateGroups={responseTemplateGroups}
            workspaceContextGroups={workspaceContextGroups}
            workspaceAssetGroups={workspaceAssetGroups}
            handoffTopicGroups={handoffTopicGroups}
            selectedTools={selectedTools}
            selectedSkills={selectedSkills}
            selectedResponseTemplateGroups={selectedResponseTemplateGroups}
            selectedContextGroups={selectedContextGroups}
            selectedAssetGroups={selectedAssetGroups}
            selectedHandoffTopicGroups={selectedHandoffTopicGroups}
            templatesTabHref={agentTabHref(wsPath, agent.id, "templates")}
            contextTabHref={agentTabHref(wsPath, agent.id, "context")}
            assetsTabHref={agentTabHref(wsPath, agent.id, "assets")}
            handoffTabHref={agentTabHref(wsPath, agent.id, "handoff")}
            toolsTabHref={agentTabHref(wsPath, agent.id, "tools")}
            workspaceContextDirty={sectionDirty.workspaceContext}
            assetGroupsDirty={sectionDirty.assetGroups}
            responseTemplatesDirty={sectionDirty.responseTemplates}
            handoffTopicsDirty={sectionDirty.handoffTopics}
            toolsDirty={sectionDirty.tools}
            skillsDirty={sectionDirty.skills}
            saving={saving}
          />
          <AgentConfigFormAutoAssignLabelsField
            defaultChecked={agent.auto_assign_conversation_labels !== false}
            sectionDirty={sectionDirty.autoAssign}
            saving={saving}
          />
          {saveError ? (
            <p className="text-sm text-destructive">{saveError}</p>
          ) : saved ? (
            <p className="text-sm text-primary">Saved successfully.</p>
          ) : null}
        </form>
      </CardContent>
    </Card>
  );
}
