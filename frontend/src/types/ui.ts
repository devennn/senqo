import type {
  AgentConfigRecord,
  AgentToolDefinitionRecord,
  WorkspaceAssetGroupSummary,
  WorkspaceContextGroupSummary,
  WorkspaceHandoffTopicGroupSummary,
  WorkspaceResponseTemplateGroupSummary,
  WorkspaceSkillDefinitionRecord,
} from "./repositories";

/** Layout mode for `PageLoader` (`components/ui/spinner`). */
export type PageLoaderLayout = "main" | "agentTabPanel";

export type AgentConfigConnectionOption = {
  id: string;
  displayName: string;
  phoneNumber: string | null;
  attachedAgentId: string | null;
};

/** Normalized shape for comparing agent profile form state to server baseline (trimmed strings, sorted id lists). */
export type AgentConfigFormNormalizedSnapshot = {
  profileName: string;
  behavior: string;
  tools: readonly string[];
  skills: readonly string[];
  responseTemplateGroups: readonly string[];
  workspaceContextGroups: readonly string[];
  assetGroups: readonly string[];
  handoffTopicGroups: readonly string[];
  attachedConnectionId: string;
  autoAssignConversationLabels: boolean;
};

export type AgentConfigFormProps = {
  agent: AgentConfigRecord;
  connections: AgentConfigConnectionOption[];
  availableTools: AgentToolDefinitionRecord[];
  availableSkills: WorkspaceSkillDefinitionRecord[];
  responseTemplateGroups: WorkspaceResponseTemplateGroupSummary[];
  workspaceContextGroups: WorkspaceContextGroupSummary[];
  workspaceAssetGroups: WorkspaceAssetGroupSummary[];
  handoffTopicGroups: WorkspaceHandoffTopicGroupSummary[];
  onSaved?: () => void;
};

export type AgentProfileBehaviorFieldsProps = {
  agent: AgentConfigRecord;
  profileNameDirty: boolean;
  profileBehaviorDirty: boolean;
  saving: boolean;
};

/** Which agent setup form sections differ from the loaded baseline (for per-section Save). */
export type AgentConfigFormSectionDirtyState = {
  profileName: boolean;
  profileBehavior: boolean;
  connection: boolean;
  workspaceContext: boolean;
  assetGroups: boolean;
  responseTemplates: boolean;
  handoffTopics: boolean;
  tools: boolean;
  skills: boolean;
  autoAssign: boolean;
};

export type AgentFormInlineSaveProps = {
  sectionDirty: boolean;
  saving: boolean;
};

export type AgentConnectionAttachFieldsProps = {
  agentId: string;
  connections: AgentConfigConnectionOption[];
} & AgentFormInlineSaveProps;

export type AgentConfigFormAutoAssignLabelsFieldProps = {
  defaultChecked: boolean;
} & AgentFormInlineSaveProps;

export type AgentConfigKnowledgeCapabilityFieldsProps = {
  availableTools: AgentToolDefinitionRecord[];
  availableSkills: WorkspaceSkillDefinitionRecord[];
  responseTemplateGroups: WorkspaceResponseTemplateGroupSummary[];
  workspaceContextGroups: WorkspaceContextGroupSummary[];
  workspaceAssetGroups: WorkspaceAssetGroupSummary[];
  handoffTopicGroups: WorkspaceHandoffTopicGroupSummary[];
  selectedTools: Set<string>;
  selectedSkills: Set<string>;
  selectedResponseTemplateGroups: Set<string>;
  selectedContextGroups: Set<string>;
  selectedAssetGroups: Set<string>;
  selectedHandoffTopicGroups: Set<string>;
  templatesTabHref: string;
  contextTabHref: string;
  assetsTabHref: string;
  handoffTabHref: string;
  workspaceContextDirty: boolean;
  assetGroupsDirty: boolean;
  responseTemplatesDirty: boolean;
  handoffTopicsDirty: boolean;
  toolsDirty: boolean;
  skillsDirty: boolean;
  saving: boolean;
};

/** Inline save on agent setup fieldset rows (Knowledge / Capability subsections). */
export type AgentConfigSubsectionInlineSaveProps = {
  subsectionDirty: boolean;
  saving: boolean;
};

export type AgentWorkspaceContextGroupsFieldsProps = {
  groups: WorkspaceContextGroupSummary[];
  selectedIds: Set<string>;
  contextTabHref: string;
} & AgentConfigSubsectionInlineSaveProps;

export type AgentResponseTemplateGroupsFieldsProps = {
  groups: WorkspaceResponseTemplateGroupSummary[];
  selectedIds: Set<string>;
  templatesTabHref: string;
} & AgentConfigSubsectionInlineSaveProps;

export type AgentHandoffTopicGroupsFieldsProps = {
  groups: WorkspaceHandoffTopicGroupSummary[];
  selectedIds: Set<string>;
  handoffTabHref: string;
} & AgentConfigSubsectionInlineSaveProps;

export type AgentAssetGroupsFieldsProps = {
  groups: WorkspaceAssetGroupSummary[];
  selectedIds: Set<string>;
  assetsTabHref: string;
} & AgentConfigSubsectionInlineSaveProps;

export type AgentToolsFieldsProps = {
  tools: AgentToolDefinitionRecord[];
  skills: WorkspaceSkillDefinitionRecord[];
  selectedTools: Set<string>;
  selectedSkills: Set<string>;
  toolsDirty: boolean;
  skillsDirty: boolean;
  saving: boolean;
};

export type CreateAgentDialogProps = {
  createAgent: () => void | Promise<void>;
};

export type AgentListProps = {
  agents: AgentConfigRecord[];
  selectedAgentId?: string;
  attachedAgentIds: string[];
  renameAgent: (formData: FormData) => boolean | Promise<boolean>;
  archiveAgent: (formData: FormData) => void | Promise<void>;
};

export type AgentListRowProps = {
  agent: AgentConfigRecord;
  isSelected: boolean;
  hasAttachedConnection: boolean;
  hasBeenUsed: boolean;
  renameAgent: (formData: FormData) => boolean | Promise<boolean>;
  archiveAgent: (formData: FormData) => void | Promise<void>;
};

export type CreateConnectionDialogProps = {
  createConnection: (displayName: string) => void | Promise<void>;
};

export type ConnectionRenameDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  connectionId: string;
  displayName: string;
  onSave: (displayName: string) => void | Promise<void>;
};

export type ContactRecord = {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  is_test: boolean;
  metadata: Record<string, unknown> | null;
  created_at: string;
  has_conversation: boolean;
  has_task: boolean;
};
