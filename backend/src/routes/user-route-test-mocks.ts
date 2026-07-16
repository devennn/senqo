import { vi } from "vitest";

vi.mock("../lib/auth-jwt.js", () => ({
  verifyToken: vi.fn(),
}));

vi.mock("../lib/env.js", () => ({
  env: { allowedProductionOrigins: [] },
}));

vi.mock("../lib/auth-users.js", () => ({
  verifyPassword: vi.fn(),
  hashPassword: vi.fn(),
}));

vi.mock("../lib/api-keys.js", () => ({
  generateApiKeyMaterial: vi.fn(),
}));

vi.mock("../lib/custom-tool-source.js", () => ({
  normalizeRequiredEnvNames: vi.fn(),
  stripLegacyToolExports: vi.fn(),
}));

vi.mock("../services/custom-tool-env.js", () => ({
  resolveCustomToolEnv: vi.fn(),
}));

vi.mock("../services/custom-tool-compile.js", () => ({
  hashCustomToolSource: vi.fn(),
}));

vi.mock("../services/tool-sandbox/run.js", () => ({
  runCustomTool: vi.fn(),
}));

vi.mock("../services/job-scheduler.js", () => ({
  scheduleAgentTask: vi.fn(),
  cancelScheduledTask: vi.fn(),
}));

vi.mock("../services/task-schedule.js", () => ({
  taskScheduleSchema: {
    extend: () => ({
      superRefine: () => ({
        safeParse: vi.fn().mockReturnValue({ success: false }),
      }),
    }),
  },
  toCronSchedule: vi.fn(),
}));

vi.mock("../services/conversation-manual.js", () => ({
  sendManualConversationMedia: vi.fn(),
  sendManualConversationMessage: vi.fn(),
}));

vi.mock("../services/whatsapp-client.js", () => ({
  startConnection: vi.fn(),
  logoutConnection: vi.fn(),
  restartConnection: vi.fn(),
  destroyConnection: vi.fn(),
}));

vi.mock("../services/whatsapp-qr.js", () => ({
  waitForQrCode: vi.fn(),
}));

vi.mock("../repositories/workspaces.js", () => ({
  validateWorkspaceMembership: vi.fn(),
  listUserWorkspaces: vi.fn(),
  createWorkspaceForUser: vi.fn(),
  getWorkspaceRow: vi.fn(),
  isWorkspaceOwner: vi.fn(),
  updateWorkspaceNameAsOwner: vi.fn(),
}));

vi.mock("../repositories/auth-users.js", () => ({
  findUserById: vi.fn(),
  updateUserPassword: vi.fn(),
}));

vi.mock("../repositories/profiles.js", () => ({
  updateProfile: vi.fn(),
  getProfileForSettings: vi.fn(),
  provisionPlatformUser: vi.fn(),
  provisionOwnerWorkspace: vi.fn(),
}));

vi.mock("../repositories/conversation-labels.js", () => ({
  listConversationLabels: vi.fn(),
  createConversationLabel: vi.fn(),
  updateConversationLabel: vi.fn(),
  deleteConversationLabel: vi.fn(),
  replaceAssignmentsForConversation: vi.fn(),
  validateLabelIdsForWorkspace: vi.fn(),
}));

vi.mock("../repositories/contacts.js", () => ({
  listContactsPage: vi.fn(),
  listContactOptions: vi.fn(),
  createContact: vi.fn(),
  createContactsBulk: vi.fn(),
  updateContactIsTest: vi.fn(),
  deleteContactWithConversationData: vi.fn(),
}));

vi.mock("../repositories/conversations.js", () => ({
  listConversations: vi.fn(),
  listConversationMessagesLatestPage: vi.fn(),
  listConversationMessagesOlderPage: vi.fn(),
  getConversationWithContact: vi.fn(),
  updateConversationHandlingMode: vi.fn(),
  deleteConversation: vi.fn(),
}));

vi.mock("../repositories/tasks.js", () => ({
  listTasksPage: vi.fn(),
  listSchedulableAgents: vi.fn(),
  getTaskById: vi.fn(),
  cancelTaskById: vi.fn(),
  createTask: vi.fn(),
}));

vi.mock("../repositories/whatsapp.js", () => ({
  listConnections: vi.fn(),
  listRecentConnectionEvents: vi.fn(),
  getConnectionById: vi.fn(),
  createConnection: vi.fn(),
  updateConnectionSyncState: vi.fn(),
  updateConnectionMode: vi.fn(),
  updateConnectionDisplayName: vi.fn(),
  deleteConnectionByWorkspace: vi.fn(),
  recordConnectionEvent: vi.fn(),
  findConnectionByAgentConfigId: vi.fn(),
  listConnectionsByAgentConfigId: vi.fn(),
  resolveWhatsappConnectionIdForAgentTask: vi.fn(),
  syncAgentWhatsappConnections: vi.fn(),
  bindAgentToWhatsappConnection: vi.fn(),
  bindAgentToFirstAvailableAuthorizedConnection: vi.fn(),
  createConversationMessage: vi.fn(),
  WHATSAPP_CONNECTION_DISPLAY_NAME_MAX_LEN: 80,
}));

vi.mock("../repositories/agent.js", () => ({
  listAgentConfigs: vi.fn(),
  createAgentConfig: vi.fn(),
  updateAgentConfig: vi.fn(),
  archiveAgentConfig: vi.fn(),
  deleteAgentConfig: vi.fn(),
  getAgentConfigById: vi.fn(),
}));

vi.mock("../repositories/workspace-secrets.js", () => ({
  listWorkspaceSecrets: vi.fn(),
  createWorkspaceSecret: vi.fn(),
  updateWorkspaceSecretValue: vi.fn(),
  deleteWorkspaceSecret: vi.fn(),
  getWorkspaceSecretById: vi.fn(),
}));

vi.mock("../repositories/api-keys.js", () => ({
  listApiKeys: vi.fn(),
  createApiKey: vi.fn(),
  deleteApiKey: vi.fn(),
}));

vi.mock("../repositories/skills.js", () => ({
  listWorkspaceSkills: vi.fn(),
  listActiveWorkspaceSkills: vi.fn().mockResolvedValue([]),
  createWorkspaceSkill: vi.fn(),
  getWorkspaceSkillById: vi.fn(),
  updateWorkspaceSkill: vi.fn(),
  deleteWorkspaceSkill: vi.fn(),
  readWorkspaceSkillContent: vi.fn(),
}));

vi.mock("../repositories/workspace-custom-tools.js", () => ({
  listWorkspaceCustomTools: vi.fn(),
  getWorkspaceCustomToolById: vi.fn(),
  upsertWorkspaceCustomTool: vi.fn(),
  deleteWorkspaceCustomTool: vi.fn(),
  validateCustomToolKeysForWorkspace: vi.fn().mockResolvedValue({ ok: true, normalized: [] }),
}));

vi.mock("../repositories/workspace-asset-groups.js", () => ({
  ASSET_GROUP_NAME_MAX_LEN: 80,
  createAgentAssetInGroup: vi.fn(),
  createWorkspaceAssetGroup: vi.fn(),
  deleteAgentAssetFromGroup: vi.fn(),
  deleteWorkspaceAssetGroup: vi.fn(),
  getWorkspaceAssetGroupDetail: vi.fn(),
  listWorkspaceAssetGroupSummaries: vi.fn().mockResolvedValue([]),
  updateAgentAssetDescription: vi.fn(),
  updateWorkspaceAssetGroupName: vi.fn(),
  validateAssetGroupIdsForWorkspace: vi.fn().mockResolvedValue({ ok: true, normalized: [] }),
}));

vi.mock("../repositories/workspace-storage.js", () => ({
  getWorkspaceStorageUsage: vi.fn().mockResolvedValue({ used: 0, limit: 1000 }),
}));

vi.mock("../repositories/response-templates.js", () => ({
  listWorkspaceResponseTemplateGroupSummaries: vi.fn().mockResolvedValue([]),
  getWorkspaceResponseTemplateGroupDetail: vi.fn(),
  createWorkspaceResponseTemplateGroup: vi.fn(),
  updateWorkspaceResponseTemplateGroupName: vi.fn(),
  addWorkspaceResponseTemplateEntry: vi.fn(),
  updateWorkspaceResponseTemplateEntry: vi.fn(),
  deleteWorkspaceResponseTemplateEntry: vi.fn(),
  deleteWorkspaceResponseTemplateGroup: vi.fn(),
  validateResponseTemplateGroupIdsForWorkspace: vi.fn().mockResolvedValue({ ok: true, normalized: [] }),
}));

vi.mock("../repositories/handoff-topic-groups.js", () => ({
  listWorkspaceHandoffTopicGroupSummaries: vi.fn().mockResolvedValue([]),
  getWorkspaceHandoffTopicGroupDetail: vi.fn(),
  createWorkspaceHandoffTopicGroup: vi.fn(),
  updateWorkspaceHandoffTopicGroupName: vi.fn(),
  addWorkspaceHandoffTopicEntry: vi.fn(),
  updateWorkspaceHandoffTopicEntry: vi.fn(),
  deleteWorkspaceHandoffTopicEntry: vi.fn(),
  deleteWorkspaceHandoffTopicGroup: vi.fn(),
  validateHandoffTopicGroupIdsForWorkspace: vi.fn().mockResolvedValue({ ok: true, normalized: [] }),
  HANDOFF_TOPIC_GROUP_NAME_MAX_LEN: 80,
  HANDOFF_TOPIC_TITLE_MAX_LEN: 200,
  HANDOFF_TOPIC_DESCRIPTION_MAX_LEN: 500,
}));

vi.mock("../repositories/workspace-context-groups.js", () => ({
  listWorkspaceContextGroupSummaries: vi.fn().mockResolvedValue([]),
  getWorkspaceContextGroupDetail: vi.fn(),
  createWorkspaceContextGroup: vi.fn(),
  updateWorkspaceContextGroupName: vi.fn(),
  addWorkspaceContextEntry: vi.fn(),
  updateWorkspaceContextEntry: vi.fn(),
  deleteWorkspaceContextEntry: vi.fn(),
  deleteWorkspaceContextGroup: vi.fn(),
  validateContextGroupIdsForWorkspace: vi.fn().mockResolvedValue({ ok: true, normalized: [] }),
  CONTEXT_GROUP_NAME_MAX_LEN: 80,
  CONTEXT_TITLE_MAX_LEN: 200,
  CONTEXT_BODY_MAX_LEN: 4000,
}));

vi.mock("../repositories/leads.js", () => ({
  findOrCreateLeadForContact: vi.fn(),
}));

vi.mock("../repositories/agent-messages.js", () => ({
  listAgentMessages: vi.fn(),
}));

vi.mock("../repositories/team.js", () => ({
  listMembers: vi.fn(),
  addMember: vi.fn(),
}));

vi.mock("../lib/job-queue.js", () => ({
  getBoss: vi.fn(),
  QUEUE_AGENT_KNOWLEDGE_IMPORT: "agent-knowledge-import",
  QUEUE_INBOUND_AI: "inbound-ai",
  QUEUE_TASK_EXECUTE: "task-execute",
}));
