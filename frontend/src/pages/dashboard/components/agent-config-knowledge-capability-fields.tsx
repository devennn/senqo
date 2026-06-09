import { useState } from "react";
import { cn } from "@/lib/utils";
import { AgentToolsFields } from "@/pages/dashboard/components/agent-tools-fields";
import { AgentResponseTemplateGroupsFields } from "@/pages/dashboard/components/agent-response-template-groups-fields";
import { AgentHandoffTopicGroupsFields } from "@/pages/dashboard/components/agent-handoff-topic-groups-fields";
import { AgentAssetGroupsFields } from "@/pages/dashboard/components/agent-asset-groups-fields";
import { AgentWorkspaceContextGroupsFields } from "@/pages/dashboard/components/agent-workspace-context-groups-fields";
import type { AgentConfigKnowledgeCapabilityFieldsProps } from "@/types/ui";

export function AgentConfigKnowledgeCapabilityFields({
  availableTools,
  availableSkills,
  responseTemplateGroups,
  workspaceContextGroups,
  workspaceAssetGroups,
  handoffTopicGroups,
  selectedTools,
  selectedSkills,
  selectedResponseTemplateGroups,
  selectedContextGroups,
  selectedAssetGroups,
  selectedHandoffTopicGroups,
  templatesTabHref,
  contextTabHref,
  assetsTabHref,
  handoffTabHref,
  workspaceContextDirty,
  assetGroupsDirty,
  responseTemplatesDirty,
  handoffTopicsDirty,
  toolsDirty,
  skillsDirty,
  saving,
}: AgentConfigKnowledgeCapabilityFieldsProps) {
  const [sectionTab, setSectionTab] = useState<"knowledge" | "capability">("knowledge");

  return (
    <div className="space-y-5">
      <div
        role="tablist"
        aria-label="Agent profile sections"
        className="flex flex-wrap gap-2 border-b border-border"
      >
        <SectionTabButton
          id="knowledge"
          label="Knowledge"
          selected={sectionTab === "knowledge"}
          onClick={() => setSectionTab("knowledge")}
        />
        <SectionTabButton
          id="capability"
          label="Capability"
          selected={sectionTab === "capability"}
          onClick={() => setSectionTab("capability")}
        />
      </div>

      <div
        role="tabpanel"
        id="agent-profile-section-knowledge"
        aria-labelledby="agent-profile-section-tab-knowledge"
        hidden={sectionTab !== "knowledge"}
        className="space-y-5"
      >
        <AgentWorkspaceContextGroupsFields
          groups={workspaceContextGroups}
          selectedIds={selectedContextGroups}
          contextTabHref={contextTabHref}
          subsectionDirty={workspaceContextDirty}
          saving={saving}
        />
        <AgentAssetGroupsFields
          groups={workspaceAssetGroups}
          selectedIds={selectedAssetGroups}
          assetsTabHref={assetsTabHref}
          subsectionDirty={assetGroupsDirty}
          saving={saving}
        />
        <AgentResponseTemplateGroupsFields
          groups={responseTemplateGroups}
          selectedIds={selectedResponseTemplateGroups}
          templatesTabHref={templatesTabHref}
          subsectionDirty={responseTemplatesDirty}
          saving={saving}
        />
        <AgentHandoffTopicGroupsFields
          groups={handoffTopicGroups}
          selectedIds={selectedHandoffTopicGroups}
          handoffTabHref={handoffTabHref}
          subsectionDirty={handoffTopicsDirty}
          saving={saving}
        />
      </div>
      <div
        role="tabpanel"
        id="agent-profile-section-capability"
        aria-labelledby="agent-profile-section-tab-capability"
        hidden={sectionTab !== "capability"}
      >
        <AgentToolsFields
          tools={availableTools}
          skills={availableSkills}
          selectedTools={selectedTools}
          selectedSkills={selectedSkills}
          toolsDirty={toolsDirty}
          skillsDirty={skillsDirty}
          saving={saving}
        />
      </div>
    </div>
  );
}

function SectionTabButton(props: {
  id: "knowledge" | "capability";
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      id={`agent-profile-section-tab-${props.id}`}
      aria-selected={props.selected}
      tabIndex={props.selected ? 0 : -1}
      onClick={props.onClick}
      className={cn(
        "relative -mb-px min-h-10 shrink-0 rounded-none border-b-2 bg-transparent px-3 py-2.5 text-sm outline-none transition-[color,border-color] focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:min-h-0 sm:px-4",
        props.selected
          ? "border-primary font-semibold text-foreground"
          : "border-transparent font-medium text-muted-foreground hover:border-border hover:text-foreground",
      )}
    >
      {props.label}
    </button>
  );
}
