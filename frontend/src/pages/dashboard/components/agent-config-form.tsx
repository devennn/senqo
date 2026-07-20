import { useState, type FormEvent } from "react";
import { useAgentConfigFormDirty } from "@/hooks/useAgentConfigFormDirty";
import { useTransientBooleanReset } from "@/hooks/useTransientBooleanReset";
import { TRANSIENT_SUCCESS_FEEDBACK_MS } from "@/lib/transient-feedback";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Bot } from "lucide-react";
import { api } from "@/lib/api";
import { AgentConnectionAttachFields } from "@/pages/dashboard/components/agent-connection-attach-fields";
import { AgentConfigFormAutoAssignLabelsField } from "@/pages/dashboard/components/agent-config-form-auto-assign-labels-field";
import { AgentConfigFormKnowledgeBlock } from "@/pages/dashboard/components/agent-config-form-knowledge-block";
import { AgentProfileBehaviorFields } from "@/pages/dashboard/components/agent-profile-behavior-fields";
import { useWorkspace } from "@/context/workspace";
import type { AgentConfigFormProps } from "@/types/ui";

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
  useTransientBooleanReset(saved, setSaved, TRANSIENT_SUCCESS_FEEDBACK_MS);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setSaveError(null);
    try {
      const fd = new FormData(e.currentTarget);
      await api.put(`/api/user/agents/${agent.id}`, {
        profileName: String(fd.get("profileName") ?? ""),
        behavior: String(fd.get("behavior") ?? ""),
        tools: fd.getAll("tools").map(String),
        skills: fd.getAll("skills").map(String),
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

  const attachedKey = connections
    .filter((c) => c.attachedAgentId === agent.id)
    .map((c) => c.id)
    .sort()
    .join(",");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bot className="size-5 text-primary" />
          Agent Profile & Behavior
        </CardTitle>
        <CardDescription>
          Configure how your AI agent responds. A Save button appears next to what you changed.
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
            key={`${agent.id}:${attachedKey}`}
            connections={connections}
            agentId={agent.id}
            sectionDirty={sectionDirty.connection}
            saving={saving}
          />
          <AgentConfigFormKnowledgeBlock
            agent={agent}
            sectionDirty={sectionDirty}
            saving={saving}
            wsPath={wsPath}
            availableTools={availableTools}
            availableSkills={availableSkills}
            responseTemplateGroups={responseTemplateGroups}
            workspaceContextGroups={workspaceContextGroups}
            workspaceAssetGroups={workspaceAssetGroups}
            handoffTopicGroups={handoffTopicGroups}
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
