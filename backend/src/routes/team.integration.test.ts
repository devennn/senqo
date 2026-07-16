import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";

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

vi.mock("../services/agent-knowledge-import.js", () => ({
  runAgentKnowledgeImportApply: vi.fn(),
  runAgentKnowledgeImportPreview: vi.fn(),
}));

vi.mock("../services/agent-knowledge-import-job.js", () => ({
  dismissAgentKnowledgeImportJobForAgent: vi.fn(),
  getAgentKnowledgeImportJob: vi.fn(),
  listAgentKnowledgeImportJobs: vi.fn(),
  saveAgentKnowledgeImportJobProgress: vi.fn(),
  startAgentKnowledgeImportJob: vi.fn(),
}));

import { verifyToken } from "../lib/auth-jwt.js";
import { validateWorkspaceMembership, isWorkspaceOwner } from "../repositories/workspaces.js";
import { listMembers, addMember } from "../repositories/team.js";

const verifyTokenMock = vi.mocked(verifyToken);
const validateWorkspaceMembershipMock = vi.mocked(validateWorkspaceMembership);
const isWorkspaceOwnerMock = vi.mocked(isWorkspaceOwner);
const listMembersMock = vi.mocked(listMembers);
const addMemberMock = vi.mocked(addMember);

let app: Hono;

const AUTH = {
  Authorization: "Bearer access-token-user-1",
  "X-Workspace-Id": "ws-1",
  "Content-Type": "application/json",
};

beforeEach(async () => {
  vi.clearAllMocks();

  verifyTokenMock.mockImplementation((token) =>
    token === "access-token-user-1"
      ? Promise.resolve({ userId: "user-1" })
      : Promise.resolve(null),
  );
  validateWorkspaceMembershipMock.mockResolvedValue(true);
  isWorkspaceOwnerMock.mockResolvedValue(true);

  const { default: userRoute } = await import("../routes/user.js");
  app = new Hono().route("/", userRoute);
});

describe("GET /team", () => {
  // Workspace members are listed for any member with workspace access.
  it("returns members list", async () => {
    listMembersMock.mockResolvedValue([
      { id: "m1", email: "alice@example.com", role: "owner", joined_at: "2026-01-01T00:00:00.000Z" },
      { id: "m2", email: "bob@example.com", role: "member", joined_at: "2026-01-02T00:00:00.000Z" },
    ]);

    const res = await app.request("/team", { headers: AUTH });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.members).toHaveLength(2);
    expect(body.members[0].email).toBe("alice@example.com");
  });
});

describe("POST /team", () => {
  // Existing Senqo user is added to the workspace successfully.
  it("adds an existing user and returns ok", async () => {
    addMemberMock.mockResolvedValue({ ok: true, message: "member_added" });

    const res = await app.request("/team", {
      method: "POST",
      headers: AUTH,
      body: JSON.stringify({ email: "bob@example.com" }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(addMemberMock).toHaveBeenCalledWith("ws-1", "bob@example.com");
  });

  // Email has no Senqo account → 404 with user_not_found so the UI can explain registration is required.
  it("returns 404 user_not_found when email is not registered", async () => {
    addMemberMock.mockResolvedValue({ ok: false, message: "user_not_found" });

    const res = await app.request("/team", {
      method: "POST",
      headers: AUTH,
      body: JSON.stringify({ email: "unknown@company.com" }),
    });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("user_not_found");
  });

  // Non-owner cannot add members.
  it("returns 403 forbidden when caller is not workspace owner", async () => {
    isWorkspaceOwnerMock.mockResolvedValue(false);

    const res = await app.request("/team", {
      method: "POST",
      headers: AUTH,
      body: JSON.stringify({ email: "bob@example.com" }),
    });

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("forbidden");
    expect(addMemberMock).not.toHaveBeenCalled();
  });

  // Already a member → 409 conflict.
  it("returns 409 already_member when user is already in the workspace", async () => {
    addMemberMock.mockResolvedValue({ ok: false, message: "already_member" });

    const res = await app.request("/team", {
      method: "POST",
      headers: AUTH,
      body: JSON.stringify({ email: "bob@example.com" }),
    });

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe("already_member");
  });
});
