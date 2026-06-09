import type { AgentConfigRecord } from "../types/repositories.js";
import type { AgentToolDefinitionRecord } from "../types/repositories.js";
import type { WorkspaceHandoffTopicGroupSummary } from "../types/repositories.js";
import type { WorkspaceSkillDefinitionRecord } from "../types/repositories.js";
import type { WorkspaceResponseTemplateGroupSummary } from "../types/repositories.js";
import type { WorkspaceContextGroupSummary } from "../types/repositories.js";

export type AgentConfigConnectionOption = {
  id: string;
  displayName: string;
  phoneNumber: string | null;
  attachedAgentId: string | null;
};

export type AgentConfigFormProps = {
  agent: AgentConfigRecord;
  connections: AgentConfigConnectionOption[];
  availableTools: AgentToolDefinitionRecord[];
  availableSkills: WorkspaceSkillDefinitionRecord[];
  responseTemplateGroups: WorkspaceResponseTemplateGroupSummary[];
  workspaceContextGroups: WorkspaceContextGroupSummary[];
  handoffTopicGroups: WorkspaceHandoffTopicGroupSummary[];
};

export type SkillsCatalogPageProps = {
  skills: WorkspaceSkillDefinitionRecord[];
  selectedSkill: WorkspaceSkillDefinitionRecord | null;
  selectedContent: string;
};

export type CreateAgentDialogProps = {
  createAgent: (formData: FormData) => void | Promise<void>;
};

export type AgentListProps = {
  agents: AgentConfigRecord[];
  selectedAgentId?: string;
  attachedAgentIds: string[];
  archiveAgent: (formData: FormData) => void | Promise<void>;
  deleteAgent: (formData: FormData) => void | Promise<void>;
};

export type AgentListRowProps = {
  agent: AgentConfigRecord;
  isSelected: boolean;
  hasAttachedConnection: boolean;
  hasBeenUsed: boolean;
  archiveAgent: (formData: FormData) => void | Promise<void>;
  deleteAgent: (formData: FormData) => void | Promise<void>;
};

export type CrmFiltersPanelProps = {
  search: string;
  hasMetadataOnly: boolean;
  inline?: boolean;
};

export type CreateConnectionDialogProps = {
  canCreateConnection: boolean;
  createConnection: (formData: FormData) => void | Promise<void>;
};

export type ContactRecord = {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
  has_conversation: boolean;
  has_task: boolean;
};
