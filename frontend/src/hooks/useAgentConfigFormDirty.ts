import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import type {
  AgentConfigRecord,
  WorkspaceCustomToolListItem,
  WorkspaceAssetGroupSummary,
  WorkspaceContextGroupSummary,
  WorkspaceHandoffTopicGroupSummary,
  WorkspaceResponseTemplateGroupSummary,
  WorkspaceSkillDefinitionRecord,
} from "@/types/repositories";
import type { AgentConfigConnectionOption, AgentConfigFormSectionDirtyState } from "@/types/ui";
import {
  agentAutoAssignSectionDirty,
  agentConfigFormSnapshotsEqual,
  agentConnectionSectionDirty,
  agentAssetGroupsDirty,
  agentLinkedDocsDirty,
  agentHandoffTopicGroupsDirty,
  agentProfileBehaviorDirty,
  agentProfileNameDirty,
  agentResponseTemplateGroupsDirty,
  agentSkillsDirty,
  agentToolsDirty,
  agentWorkspaceContextGroupsDirty,
  buildAgentConfigFormBaseline,
  readAgentConfigFormSnapshot,
} from "@/lib/agent-config-form-snapshot";

type Args = {
  agent: AgentConfigRecord;
  connections: AgentConfigConnectionOption[];
  availableTools: WorkspaceCustomToolListItem[];
  availableSkills: WorkspaceSkillDefinitionRecord[];
  responseTemplateGroups: WorkspaceResponseTemplateGroupSummary[];
  workspaceContextGroups: WorkspaceContextGroupSummary[];
  workspaceAssetGroups: WorkspaceAssetGroupSummary[];
  workspaceLinkedDocs: Array<{ id: string }>;
  handoffTopicGroups: WorkspaceHandoffTopicGroupSummary[];
};

const emptySections: AgentConfigFormSectionDirtyState = {
  profileName: false,
  profileBehavior: false,
  connection: false,
  workspaceContext: false,
  assetGroups: false,
  linkedDocs: false,
  responseTemplates: false,
  handoffTopics: false,
  tools: false,
  skills: false,
  autoAssign: false,
};

export function useAgentConfigFormDirty({
  agent,
  connections,
  availableTools,
  availableSkills,
  responseTemplateGroups,
  workspaceContextGroups,
  workspaceAssetGroups,
  workspaceLinkedDocs,
  handoffTopicGroups,
}: Args): {
  formRef: RefObject<HTMLFormElement | null>;
  isDirty: boolean;
  sectionDirty: AgentConfigFormSectionDirtyState;
  formBaselineProps: { onChange: () => void; onInput: () => void };
} {
  const formRef = useRef<HTMLFormElement>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [sectionDirty, setSectionDirty] = useState<AgentConfigFormSectionDirtyState>(emptySections);

  const baseline = useMemo(
    () =>
      buildAgentConfigFormBaseline({
        agent,
        connections,
        availableTools,
        availableSkills,
        responseTemplateGroups,
        workspaceContextGroups,
        workspaceAssetGroups,
        workspaceLinkedDocs,
        handoffTopicGroups,
      }),
    [
      agent,
      connections,
      availableTools,
      availableSkills,
      responseTemplateGroups,
      workspaceContextGroups,
      workspaceAssetGroups,
      workspaceLinkedDocs,
      handoffTopicGroups,
    ],
  );

  useEffect(() => {
    setIsDirty(false);
    setSectionDirty(emptySections);
  }, [baseline]);

  const reconcileDirty = useCallback(() => {
    const form = formRef.current;
    if (!form) return;
    const current = readAgentConfigFormSnapshot(form);
    setIsDirty(!agentConfigFormSnapshotsEqual(baseline, current));
    setSectionDirty({
      profileName: agentProfileNameDirty(baseline, current),
      profileBehavior: agentProfileBehaviorDirty(baseline, current),
      connection: agentConnectionSectionDirty(baseline, current),
      workspaceContext: agentWorkspaceContextGroupsDirty(baseline, current),
      assetGroups: agentAssetGroupsDirty(baseline, current),
      linkedDocs: agentLinkedDocsDirty(baseline, current),
      responseTemplates: agentResponseTemplateGroupsDirty(baseline, current),
      handoffTopics: agentHandoffTopicGroupsDirty(baseline, current),
      tools: agentToolsDirty(baseline, current),
      skills: agentSkillsDirty(baseline, current),
      autoAssign: agentAutoAssignSectionDirty(baseline, current),
    });
  }, [baseline]);

  const formBaselineProps = useMemo(
    () => ({
      onChange: reconcileDirty,
      onInput: reconcileDirty,
    }),
    [reconcileDirty],
  );

  return { formRef, isDirty, sectionDirty, formBaselineProps };
}
