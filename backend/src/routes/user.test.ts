import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("../lib/auth-jwt.js", () => ({
  verifyToken: vi.fn(),
  signAccessToken: vi.fn(),
  signRefreshToken: vi.fn(),
  verifyRefreshToken: vi.fn(),
}));

vi.mock("../lib/env.js", () => ({
  env: { allowedProductionOrigins: [] },
}));

vi.mock("../lib/auth-users.js", () => ({
  verifyPassword: vi.fn(),
  hashPassword: vi.fn(),
}));

vi.mock("../lib/api-keys.js", () => ({
  generateApiKeyMaterial: vi.fn().mockReturnValue({
    rawKey: "raw-key-abc",
    keyPrefix: "sk_",
    keyHash: "hashed",
  }),
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

vi.mock("../services/email.js", () => ({
  sendRegistrationInviteEmail: vi.fn(),
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

vi.mock("../repositories/team.js", () => ({
  listMembers: vi.fn(),
  addMember: vi.fn(),
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

vi.mock("../repositories/registration-invites.js", () => ({
  createRegistrationInvite: vi.fn(),
  getRegistrationInviteByToken: vi.fn(),
  acceptRegistrationInvite: vi.fn(),
}));

vi.mock("../repositories/instance-settings.js", () => ({
  getAllowPublicRegistration: vi.fn().mockResolvedValue(true),
}));

// ── Imports (after mocks) ─────────────────────────────────────────────────────

import { verifyToken } from "../lib/auth-jwt.js";
import { validateWorkspaceMembership, listUserWorkspaces, createWorkspaceForUser } from "../repositories/workspaces.js";
import { listConversationLabels, createConversationLabel, deleteConversationLabel } from "../repositories/conversation-labels.js";
import { listContactsPage } from "../repositories/contacts.js";
import { listConversations } from "../repositories/conversations.js";
import { listTasksPage, listSchedulableAgents } from "../repositories/tasks.js";
import { listConnections, listRecentConnectionEvents } from "../repositories/whatsapp.js";
import { listWorkspaceSecrets, createWorkspaceSecret, deleteWorkspaceSecret } from "../repositories/workspace-secrets.js";
import { listApiKeys, createApiKey, deleteApiKey } from "../repositories/api-keys.js";
import { listMembers } from "../repositories/team.js";
import { listAgentConfigs, createAgentConfig } from "../repositories/agent.js";
import { findUserById } from "../repositories/auth-users.js";
import { getProfileForSettings, updateProfile } from "../repositories/profiles.js";
import { getWorkspaceRow } from "../repositories/workspaces.js";
import { generateApiKeyMaterial } from "../lib/api-keys.js";

const verifyTokenMock = vi.mocked(verifyToken);
const validateWorkspaceMembershipMock = vi.mocked(validateWorkspaceMembership);
const listUserWorkspacesMock = vi.mocked(listUserWorkspaces);
const createWorkspaceForUserMock = vi.mocked(createWorkspaceForUser);
const listConversationLabelsMock = vi.mocked(listConversationLabels);
const createConversationLabelMock = vi.mocked(createConversationLabel);
const deleteConversationLabelMock = vi.mocked(deleteConversationLabel);
const listContactsPageMock = vi.mocked(listContactsPage);
const listConversationsMock = vi.mocked(listConversations);
const listTasksPageMock = vi.mocked(listTasksPage);
const listSchedulableAgentsMock = vi.mocked(listSchedulableAgents);
const listConnectionsMock = vi.mocked(listConnections);
const listRecentConnectionEventsMock = vi.mocked(listRecentConnectionEvents);
const listWorkspaceSecretsMock = vi.mocked(listWorkspaceSecrets);
const createWorkspaceSecretMock = vi.mocked(createWorkspaceSecret);
const deleteWorkspaceSecretMock = vi.mocked(deleteWorkspaceSecret);
const listApiKeysMock = vi.mocked(listApiKeys);
const createApiKeyMock = vi.mocked(createApiKey);
const deleteApiKeyMock = vi.mocked(deleteApiKey);
const listMembersMock = vi.mocked(listMembers);
const listAgentConfigsMock = vi.mocked(listAgentConfigs);
const createAgentConfigMock = vi.mocked(createAgentConfig);
const findUserByIdMock = vi.mocked(findUserById);
const getProfileForSettingsMock = vi.mocked(getProfileForSettings);
const updateProfileMock = vi.mocked(updateProfile);
const getWorkspaceRowMock = vi.mocked(getWorkspaceRow);
const generateApiKeyMaterialMock = vi.mocked(generateApiKeyMaterial);

// ── Test app setup ─────────────────────────────────────────────────────────────

let app: Hono;

const AUTH = {
  Authorization: "Bearer access-token-user-1",
  "X-Workspace-Id": "ws-1",
  "Content-Type": "application/json",
};

const AUTH_NO_WS = {
  Authorization: "Bearer access-token-user-1",
  "Content-Type": "application/json",
};

beforeEach(async () => {
  vi.clearAllMocks();

  // Auth middleware: valid token resolves to user-1
  verifyTokenMock.mockImplementation((token) =>
    token === "access-token-user-1"
      ? Promise.resolve({ userId: "user-1" })
      : Promise.resolve(null),
  );

  // Workspace middleware: membership always passes for ws-1
  validateWorkspaceMembershipMock.mockResolvedValue(true);

  // Dynamic import after mocks are wired
  const { default: userRoute } = await import("../routes/user.js");
  app = new Hono().route("/", userRoute);
});

// ── Workspaces ────────────────────────────────────────────────────────────────

describe("GET /workspaces", () => {
  // Lists workspaces for the authenticated user and returns them in the response body.
  // This verifies the happy path of the workspace list endpoint.
  it("returns workspace list for authenticated user", async () => {
    listUserWorkspacesMock.mockResolvedValue([
      { id: "ws-1", name: "My Workspace", role: "owner", ownerUserId: "user-1", createdAt: new Date() },
    ]);

    const res = await app.request("/workspaces", { headers: AUTH_NO_WS });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.workspaces).toHaveLength(1);
    expect(body.workspaces[0].name).toBe("My Workspace");
  });

  // No auth token → 401, proving the auth middleware is applied to all routes.
  it("returns 401 without auth token", async () => {
    const res = await app.request("/workspaces");
    expect(res.status).toBe(401);
  });
});

describe("POST /workspaces", () => {
  // Valid name → workspace created, workspaceId returned.
  // Verifies that the creation endpoint correctly delegates to the repository and returns the new ID.
  it("creates workspace and returns workspaceId", async () => {
    createWorkspaceForUserMock.mockResolvedValue({ ok: true, workspaceId: "ws-new" });

    const res = await app.request("/workspaces", {
      method: "POST",
      headers: AUTH_NO_WS,
      body: JSON.stringify({ name: "New Workspace" }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.workspaceId).toBe("ws-new");
  });

  // Missing name → 400 from Zod validation. Prevents empty workspace names reaching the DB.
  it("returns 400 when name is missing", async () => {
    const res = await app.request("/workspaces", {
      method: "POST",
      headers: AUTH_NO_WS,
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });
});

// ── Conversation labels ────────────────────────────────────────────────────────

describe("GET /conversation-labels", () => {
  // Returns all labels for the workspace. Used by the dashboard filter and agent config.
  it("returns labels array", async () => {
    listConversationLabelsMock.mockResolvedValue([
      { id: "lbl-1", name: "Support", description: "", workspace_id: "ws-1", created_at: new Date() },
    ]);

    const res = await app.request("/conversation-labels", { headers: AUTH });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.labels).toHaveLength(1);
    expect(body.labels[0].name).toBe("Support");
  });

  // No X-Workspace-Id header → 400. Workspace scope is required for all workspace routes.
  it("returns 400 without workspace header", async () => {
    const res = await app.request("/conversation-labels", { headers: AUTH_NO_WS });
    expect(res.status).toBe(400);
  });
});

describe("POST /conversation-labels", () => {
  // Valid label → id returned. Confirms the create endpoint stores and returns the new label ID.
  it("creates label and returns id", async () => {
    createConversationLabelMock.mockResolvedValue({ ok: true, id: "lbl-2" });

    const res = await app.request("/conversation-labels", {
      method: "POST",
      headers: AUTH,
      body: JSON.stringify({ name: "VIP" }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe("lbl-2");
  });

  // Empty name fails Zod min(1) → 400. Prevents blank label names.
  it("returns 400 with empty name", async () => {
    const res = await app.request("/conversation-labels", {
      method: "POST",
      headers: AUTH,
      body: JSON.stringify({ name: "" }),
    });
    expect(res.status).toBe(400);
  });
});

describe("DELETE /conversation-labels/:id", () => {
  // Successful delete → { ok: true }. Verifies the delete endpoint delegates correctly.
  it("deletes label and returns ok", async () => {
    deleteConversationLabelMock.mockResolvedValue({ ok: true });

    const res = await app.request("/conversation-labels/lbl-1", {
      method: "DELETE",
      headers: AUTH,
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });
});

// ── Contacts ──────────────────────────────────────────────────────────────────

describe("GET /contacts", () => {
  // Paginated contact list returned. Verifies the shape of the paginated response expected by the frontend.
  it("returns paginated contacts", async () => {
    listContactsPageMock.mockResolvedValue({
      items: [{ id: "c1", first_name: "Alice", last_name: "Smith", phone: "+1234567890", is_test: false }],
      total: 25,
      page: 1,
      pageSize: 10,
    });

    const res = await app.request("/contacts", { headers: AUTH });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.contacts).toHaveLength(1);
    expect(body.total).toBe(25);
    expect(body.page).toBe(1);
    expect(body.pageSize).toBe(10);
  });

  // Page 2 query param is forwarded to the repository.
  // Verifies the route correctly parses and passes the page param.
  it("forwards page param to repository", async () => {
    listContactsPageMock.mockResolvedValue({ items: [], total: 0, page: 2, pageSize: 10 });

    await app.request("/contacts?page=2", { headers: AUTH });

    expect(listContactsPageMock).toHaveBeenCalledWith(
      "ws-1",
      expect.objectContaining({ page: 2 }),
    );
  });
});

// ── Conversations ─────────────────────────────────────────────────────────────

describe("GET /conversations", () => {
  // Returns conversations array. Verifies the basic list endpoint response shape.
  it("returns conversations array", async () => {
    listConversationsMock.mockResolvedValue([
      { id: "conv-1", contact: { first_name: "Alice" }, lastMessage: null },
    ]);

    const res = await app.request("/conversations", { headers: AUTH });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.conversations).toHaveLength(1);
  });

  // labelId query param is passed through to the repository filter.
  // Verifies conversation filtering by label works end-to-end at the route level.
  it("passes labelId filter to repository", async () => {
    listConversationsMock.mockResolvedValue([]);

    await app.request("/conversations?labelId=lbl-1", { headers: AUTH });

    expect(listConversationsMock).toHaveBeenCalledWith(
      "ws-1",
      expect.objectContaining({ labelId: "lbl-1" }),
    );
  });

  // humanOnly=1 param enables the human-handling-only filter.
  it("passes humanOnly filter when param is '1'", async () => {
    listConversationsMock.mockResolvedValue([]);

    await app.request("/conversations?humanOnly=1", { headers: AUTH });

    expect(listConversationsMock).toHaveBeenCalledWith(
      "ws-1",
      expect.objectContaining({ humanHandlingOnly: true }),
    );
  });
});

// ── Tasks ─────────────────────────────────────────────────────────────────────

describe("GET /tasks", () => {
  // Returns tasks and schedulable agents. Verifies the combined response needed by the tasks page.
  it("returns tasks and agents", async () => {
    listTasksPageMock.mockResolvedValue({ items: [{ id: "t1", status: "active" }], total: 1, page: 1, pageSize: 10 });
    listSchedulableAgentsMock.mockResolvedValue([{ id: "agent-1", profile_name: "Bot" }]);

    const res = await app.request("/tasks", { headers: AUTH });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.tasks).toHaveLength(1);
    expect(body.agents).toHaveLength(1);
    expect(body.total).toBe(1);
  });

  // Empty results → empty arrays, not null. Prevents frontend null-access errors.
  it("returns empty tasks and agents when none exist", async () => {
    listTasksPageMock.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 10 });
    listSchedulableAgentsMock.mockResolvedValue([]);

    const res = await app.request("/tasks", { headers: AUTH });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.tasks).toHaveLength(0);
    expect(body.agents).toHaveLength(0);
  });
});

// ── Connections ───────────────────────────────────────────────────────────────

describe("GET /connections", () => {
  // Returns connections and events. Verifies the combined response shape the frontend expects.
  it("returns connections and events", async () => {
    listConnectionsMock.mockResolvedValue([{ id: "conn-1", display_name: "My Phone" }]);
    listRecentConnectionEventsMock.mockResolvedValue([]);

    const res = await app.request("/connections", { headers: AUTH });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.connections).toHaveLength(1);
    expect(body.events).toHaveLength(0);
    expect(body.canCreateConnection).toBe(true);
  });
});

// ── Secrets ───────────────────────────────────────────────────────────────────

describe("GET /secrets", () => {
  // Lists workspace secrets. Secret values are never returned, only names and hints.
  it("returns secrets list", async () => {
    listWorkspaceSecretsMock.mockResolvedValue([
      { id: "sec-1", name: "MY_API_KEY", description: "", value_hint: "abc" },
    ]);

    const res = await app.request("/secrets", { headers: AUTH });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.secrets).toHaveLength(1);
    expect(body.secrets[0].name).toBe("MY_API_KEY");
  });
});

describe("POST /secrets", () => {
  // Valid name + value → secretId returned and value echoed back (shown once only).
  // Verifies the create-and-reveal pattern for workspace secrets.
  it("creates secret and returns secretId and value", async () => {
    createWorkspaceSecretMock.mockResolvedValue({ ok: true, secretId: "sec-new" });

    const res = await app.request("/secrets", {
      method: "POST",
      headers: AUTH,
      body: JSON.stringify({ name: "API_KEY", value: "supersecret" }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.secretId).toBe("sec-new");
    expect(body.value).toBe("supersecret");
  });

  // Missing name → 400. Prevents blank secret names reaching the DB.
  it("returns 400 when name is missing", async () => {
    const res = await app.request("/secrets", {
      method: "POST",
      headers: AUTH,
      body: JSON.stringify({ value: "supersecret" }),
    });
    expect(res.status).toBe(400);
  });
});

describe("DELETE /secrets/:id", () => {
  // Successful delete → { ok: true }.
  it("deletes secret and returns ok", async () => {
    deleteWorkspaceSecretMock.mockResolvedValue({ ok: true });

    const res = await app.request("/secrets/sec-1", {
      method: "DELETE",
      headers: AUTH,
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });
});

// ── API keys ──────────────────────────────────────────────────────────────────

describe("GET /api-keys", () => {
  // Lists API keys without revealing full key values.
  it("returns api keys list", async () => {
    listApiKeysMock.mockResolvedValue([
      { id: "key-1", label: "CI Key", key_prefix: "sk_", expires_at: null, created_at: new Date() },
    ]);

    const res = await app.request("/api-keys", { headers: AUTH });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.apiKeys).toHaveLength(1);
    expect(body.apiKeys[0].label).toBe("CI Key");
  });
});

describe("POST /api-keys", () => {
  // Creates an API key and returns the raw key (shown once).
  // Verifies the full key is returned immediately after creation so the user can copy it.
  it("creates api key and returns raw key", async () => {
    generateApiKeyMaterialMock.mockReturnValue({ rawKey: "sk_raw123", keyPrefix: "sk_", keyHash: "hashed" });
    createApiKeyMock.mockResolvedValue({ ok: true, id: "key-new" });

    const res = await app.request("/api-keys", {
      method: "POST",
      headers: AUTH,
      body: JSON.stringify({ label: "My Key", expiresAt: null }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.apiKey).toBe("sk_raw123");
    expect(body.label).toBe("My Key");
  });

  // Missing label → 400 from Zod validation.
  it("returns 400 when label is missing", async () => {
    const res = await app.request("/api-keys", {
      method: "POST",
      headers: AUTH,
      body: JSON.stringify({ expiresAt: null }),
    });
    expect(res.status).toBe(400);
  });
});

// ── Profile ───────────────────────────────────────────────────────────────────

describe("GET /profile", () => {
  // Returns combined profile, workspace info, and storage usage in one call.
  // The profile page needs all three without separate requests.
  it("returns profile, workspace, and storage", async () => {
    findUserByIdMock.mockResolvedValue({
      id: "user-1",
      email: "user@example.com",
      passwordHash: "hash",
      isInstanceAdmin: false,
      disabledAt: null,
      createdAt: new Date(),
    });
    getProfileForSettingsMock.mockResolvedValue({
      id: "user-1",
      first_name: "Alice",
      last_name: "Smith",
    });
    getWorkspaceRowMock.mockResolvedValue({
      id: "ws-1",
      name: "Test Workspace",
      ownerUserId: "user-1",
      createdAt: new Date(),
    });

    const res = await app.request("/profile", { headers: AUTH });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.profile.email).toBe("user@example.com");
    expect(body.profile.firstName).toBe("Alice");
    expect(body.workspace.name).toBe("Test Workspace");
    expect(body.workspace.role).toBe("owner");
  });
});

describe("PUT /profile", () => {
  // Updates first and last name. Verifies the update is delegated to the repository.
  it("updates profile and returns ok", async () => {
    updateProfileMock.mockResolvedValue(undefined);

    const res = await app.request("/profile", {
      method: "PUT",
      headers: AUTH,
      body: JSON.stringify({ firstName: "Bob", lastName: "Jones" }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(updateProfileMock).toHaveBeenCalledWith("user-1", {
      first_name: "Bob",
      last_name: "Jones",
    });
  });
});

// ── Team ──────────────────────────────────────────────────────────────────────

describe("GET /team", () => {
  // Returns team members for the workspace.
  it("returns members list", async () => {
    listMembersMock.mockResolvedValue([
      { id: "m1", email: "alice@example.com", role: "owner" },
      { id: "m2", email: "bob@example.com", role: "member" },
    ]);

    const res = await app.request("/team", { headers: AUTH });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.members).toHaveLength(2);
    expect(body.members[0].email).toBe("alice@example.com");
  });
});

// ── Agents ────────────────────────────────────────────────────────────────────

describe("GET /agents", () => {
  // Returns agents alongside supporting data needed by the agent setup page.
  it("returns agents with related data", async () => {
    listAgentConfigsMock.mockResolvedValue([
      { id: "agent-1", profile_name: "Test Agent", behavior: "Be helpful" },
    ]);
    listConnectionsMock.mockResolvedValue([]);

    const res = await app.request("/agents", { headers: AUTH });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.agents).toHaveLength(1);
    expect(body.agents[0].profile_name).toBe("Test Agent");
    expect(Array.isArray(body.agentIdsWithConnection)).toBe(true);
  });
});

describe("POST /agents", () => {
  // Creates a new agent and returns its id.
  it("creates agent and returns id", async () => {
    createAgentConfigMock.mockResolvedValue({ ok: true, id: "agent-new" });

    const res = await app.request("/agents", {
      method: "POST",
      headers: AUTH,
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe("agent-new");
  });
});
