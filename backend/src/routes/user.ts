import { Hono } from "hono";
import { z } from "zod";
import { authMiddleware } from "../middleware/auth.js";
import type { AuthVariables } from "../middleware/auth.js";
import { workspaceMiddleware } from "../middleware/workspace.js";
import type { WorkspaceVariables } from "../middleware/workspace.js";
import { findUserById, updateUserPassword } from "../repositories/auth-users.js";
import { verifyPassword, hashPassword } from "../lib/auth-users.js";
import { parseListPageParams } from "../lib/pagination.js";
import {
  listAgentConfigs,
  createAgentConfig,
  updateAgentConfig,
  archiveAgentConfig,
  deleteAgentConfig,
  getAgentConfigById,
} from "../repositories/agent.js";
import {
  ASSET_GROUP_NAME_MAX_LEN,
  createAgentAssetInGroup,
  createWorkspaceAssetGroup,
  deleteAgentAssetFromGroup,
  deleteWorkspaceAssetGroup,
  getWorkspaceAssetGroupDetail,
  listWorkspaceAssetGroupSummaries,
  updateAgentAssetDescription,
  updateWorkspaceAssetGroupName,
  validateAssetGroupIdsForWorkspace,
} from "../repositories/workspace-asset-groups.js";
import { getWorkspaceStorageUsage } from "../repositories/workspace-storage.js";
import {
  listWorkspaceResponseTemplateGroupSummaries,
  getWorkspaceResponseTemplateGroupDetail,
  createWorkspaceResponseTemplateGroup,
  updateWorkspaceResponseTemplateGroupName,
  addWorkspaceResponseTemplateEntry,
  updateWorkspaceResponseTemplateEntry,
  deleteWorkspaceResponseTemplateEntry,
  deleteWorkspaceResponseTemplateGroup,
  validateResponseTemplateGroupIdsForWorkspace,
} from "../repositories/response-templates.js";
import {
  listWorkspaceHandoffTopicGroupSummaries,
  getWorkspaceHandoffTopicGroupDetail,
  createWorkspaceHandoffTopicGroup,
  updateWorkspaceHandoffTopicGroupName,
  addWorkspaceHandoffTopicEntry,
  updateWorkspaceHandoffTopicEntry,
  deleteWorkspaceHandoffTopicEntry,
  deleteWorkspaceHandoffTopicGroup,
  validateHandoffTopicGroupIdsForWorkspace,
  HANDOFF_TOPIC_GROUP_NAME_MAX_LEN,
  HANDOFF_TOPIC_TITLE_MAX_LEN,
  HANDOFF_TOPIC_DESCRIPTION_MAX_LEN,
} from "../repositories/handoff-topic-groups.js";
import {
  runAgentKnowledgeImportApply,
  runAgentKnowledgeImportPreview,
} from "../services/agent-knowledge-import.js";
import {
  dismissAgentKnowledgeImportJobForAgent,
  getAgentKnowledgeImportJob,
  listAgentKnowledgeImportJobs,
  saveAgentKnowledgeImportJobProgress,
  startAgentKnowledgeImportJob,
} from "../services/agent-knowledge-import-job.js";
import {
  listWorkspaceContextGroupSummaries,
  getWorkspaceContextGroupDetail,
  createWorkspaceContextGroup,
  updateWorkspaceContextGroupName,
  addWorkspaceContextEntry,
  updateWorkspaceContextEntry,
  deleteWorkspaceContextEntry,
  deleteWorkspaceContextGroup,
  validateContextGroupIdsForWorkspace,
  CONTEXT_GROUP_NAME_MAX_LEN,
  CONTEXT_TITLE_MAX_LEN,
  CONTEXT_BODY_MAX_LEN,
} from "../repositories/workspace-context-groups.js";
import {
  listWorkspaceCustomTools,
  getWorkspaceCustomToolById,
  upsertWorkspaceCustomTool,
  deleteWorkspaceCustomTool,
  validateCustomToolKeysForWorkspace,
} from "../repositories/workspace-custom-tools.js";
import {
  listWorkspaceSecrets,
  createWorkspaceSecret,
  updateWorkspaceSecretValue,
  deleteWorkspaceSecret,
  getWorkspaceSecretById,
} from "../repositories/workspace-secrets.js";
import { normalizeRequiredEnvNames, stripLegacyToolExports } from "../lib/custom-tool-source.js";
import { resolveCustomToolEnv } from "../services/custom-tool-env.js";
import { hashCustomToolSource } from "../services/custom-tool-compile.js";
import { runCustomTool } from "../services/tool-sandbox/run.js";
import {
  listWorkspaceSkills,
  listActiveWorkspaceSkills,
  createWorkspaceSkill,
  getWorkspaceSkillById,
  updateWorkspaceSkill,
  deleteWorkspaceSkill,
  readWorkspaceSkillContent,
} from "../repositories/skills.js";
import {
  listConnections,
  getConnectionById,
  createConnection,
  bindAgentToFirstAvailableAuthorizedConnection,
  syncAgentWhatsappConnections,
  listConnectionsByAgentConfigId,
  resolveWhatsappConnectionIdForAgentTask,
  updateConnectionSyncState,
  updateConnectionMode,
  updateConnectionDisplayName,
  WHATSAPP_CONNECTION_DISPLAY_NAME_MAX_LEN,
  listRecentConnectionEvents,
  recordConnectionEvent,
  deleteConnectionByWorkspace,
  createConversationMessage,
} from "../repositories/whatsapp.js";
import {
  createContact,
  createContactsBulk,
  deleteContactWithConversationData,
  listContactOptions,
  listContactsPage,
  updateContactIsTest,
} from "../repositories/contacts.js";
import {
  listConversations,
  listConversationMessagesLatestPage,
  listConversationMessagesOlderPage,
  getConversationWithContact,
  updateConversationHandlingMode,
  deleteConversation,
} from "../repositories/conversations.js";
import {
  listConversationLabels,
  createConversationLabel,
  updateConversationLabel,
  deleteConversationLabel,
  replaceAssignmentsForConversation,
  validateLabelIdsForWorkspace,
} from "../repositories/conversation-labels.js";
import {
  createTask,
  listTasksPage,
  listSchedulableAgents,
  getTaskById,
  cancelTaskById,
} from "../repositories/tasks.js";
import { addMember, listMembers } from "../repositories/team.js";
import {
  updateProfile,
  getProfileForSettings,
  provisionPlatformUser,
} from "../repositories/profiles.js";
import {
  getWorkspaceRow,
  isWorkspaceOwner,
  updateWorkspaceNameAsOwner,
  listUserWorkspaces,
  createWorkspaceForUser,
} from "../repositories/workspaces.js";
import { listAgentMessages } from "../repositories/agent-messages.js";
import {
  scheduleAgentTask,
  cancelScheduledTask,
} from "../services/job-scheduler.js";
import {
  taskScheduleSchema,
  toCronSchedule,
} from "../services/task-schedule.js";
import {
  sendManualConversationMedia,
  sendManualConversationMessage,
} from "../services/conversation-manual.js";
import {
  startConnection,
  logoutConnection,
  restartConnection,
  destroyConnection,
} from "../services/whatsapp-client.js";
import { waitForQrCode } from "../services/whatsapp-qr.js";
import { findOrCreateLeadForContact } from "../repositories/leads.js";
import { env } from "../lib/env.js";
import { generateApiKeyMaterial } from "../lib/api-keys.js";
import {
  createApiKey,
  deleteApiKey,
  listApiKeys,
} from "../repositories/api-keys.js";
import { THREAD_EVENT_MANUAL_TOGGLE } from "../lib/conversation-thread-events.js";

type Variables = AuthVariables & WorkspaceVariables;

const app = new Hono<{ Variables: Variables }>();

app.use("*", authMiddleware);

// ── Platform (no workspace scope) ───────────────────────────────────────────

app.get("/workspaces", async (c) => {
  const userId = c.get("userId");
  const workspaces = await listUserWorkspaces(userId);
  return c.json({ workspaces });
});

const createWorkspaceSchema = z.object({
  name: z.string().trim().min(1).max(120),
});

app.post("/workspaces", async (c) => {
  const userId = c.get("userId");
  const parsed = createWorkspaceSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "invalid_payload" }, 400);

  const result = await createWorkspaceForUser(userId, parsed.data.name);
  if (!result.ok) return c.json({ error: result.message }, 400);

  return c.json({ ok: true, workspaceId: result.workspaceId });
});

app.use("*", workspaceMiddleware);

const createApiKeySchema = z.object({
  label: z.string().trim().min(1).max(80),
  expiresAt: z.string().datetime().nullable(),
});

app.get("/api-keys", async (c) => {
  const workspaceId = c.get("workspaceId");
  const apiKeys = await listApiKeys(workspaceId);
  return c.json({ apiKeys });
});

app.post("/api-keys", async (c) => {
  const workspaceId = c.get("workspaceId");
  const userId = c.get("userId");
  const parsed = createApiKeySchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "invalid_payload" }, 400);

  const { rawKey, keyPrefix, keyHash } = generateApiKeyMaterial();
  const created = await createApiKey({
    workspaceId,
    label: parsed.data.label,
    keyHash,
    keyPrefix,
    createdByUserId: userId,
    expiresAt: parsed.data.expiresAt,
  });
  if (!created.ok) return c.json({ error: "api_key_create_failed" }, 500);
  return c.json({
    apiKey: rawKey,
    keyPrefix,
    label: parsed.data.label,
    expiresAt: parsed.data.expiresAt,
  });
});

app.delete("/api-keys/:id", async (c) => {
  const workspaceId = c.get("workspaceId");
  const apiKeyId = c.req.param("id");
  const deleted = await deleteApiKey(workspaceId, apiKeyId);
  if (!deleted) return c.json({ error: "api_key_delete_failed" }, 500);
  return c.json({ ok: true });
});

// ── Agents ──────────────────────────────────────────────────────────────────

app.get("/agents", async (c) => {
  const userId = c.get("userId");
  const workspaceId = c.get("workspaceId");

  const [
    agents,
    connections,
    responseTemplateGroups,
    handoffTopicGroups,
    workspaceContextGroups,
    workspaceAssetGroups,
  ] = await Promise.all([
    listAgentConfigs(workspaceId),
    listConnections(workspaceId),
    listWorkspaceResponseTemplateGroupSummaries(workspaceId),
    listWorkspaceHandoffTopicGroupSummaries(workspaceId),
    listWorkspaceContextGroupSummaries(workspaceId),
    listWorkspaceAssetGroupSummaries(workspaceId),
  ]);
  const agentIdsWithConnection = new Set(
    connections.map((conn) => conn.agent_config_id).filter(Boolean),
  );

  return c.json({
    agents,
    agentIdsWithConnection: [...agentIdsWithConnection],
    responseTemplateGroups,
    handoffTopicGroups,
    workspaceContextGroups,
    workspaceAssetGroups,
  });
});

app.post("/agents", async (c) => {
  const workspaceId = c.get("workspaceId");
  const result = await createAgentConfig({
    workspace_id: workspaceId,
    profile_name: "New Agent",
  });
  if (!result.ok || !result.id)
    return c.json({ error: "agent_create_failed" }, 500);
  return c.json({ id: result.id });
});

const updateAgentSchema = z.object({
  profileName: z.string().min(1),
  behavior: z.string(),
  tools: z.array(z.string()),
  skills: z.array(z.string()),
  /** When present (including []), sync attachments. When omitted, leave attachments unchanged. */
  attachedConnectionIds: z.array(z.string().uuid()).optional(),
  autoAssignConversationLabels: z.boolean().optional().default(true),
  responseTemplateGroups: z.array(z.string().uuid()).max(40).optional(),
  handoffTopicGroups: z.array(z.string().uuid()).max(40).optional(),
  contextGroups: z.array(z.string().uuid()).max(40).optional(),
  assetGroups: z.array(z.string().uuid()).max(40).optional(),
});

app.put("/agents/:id", async (c) => {
  const workspaceId = c.get("workspaceId");
  const agentId = c.req.param("id");
  const body = updateAgentSchema.safeParse(await c.req.json());
  if (!body.success) return c.json({ error: "Invalid payload" }, 400);

  const existing = await getAgentConfigById(workspaceId, agentId);
  if (!existing) {
    return c.json({ error: "agent_not_found" }, 404);
  }

  const [toolValidation, allowedSkills] = await Promise.all([
    validateCustomToolKeysForWorkspace(workspaceId, body.data.tools),
    listActiveWorkspaceSkills(workspaceId),
  ]);
  if (!toolValidation.ok) {
    return c.json({ error: "invalid_custom_tools", message: toolValidation.message }, 400);
  }
  const allowedSkillKeys = new Set(allowedSkills.map((s) => s.skill_key));
  const normalizedTools = toolValidation.normalized;
  const normalizedSkills = [...new Set(body.data.skills)].filter((k) =>
    allowedSkillKeys.has(k),
  );

  let responseTemplateGroups = existing.response_template_groups;
  if (body.data.responseTemplateGroups !== undefined) {
    const validated = await validateResponseTemplateGroupIdsForWorkspace(
      workspaceId,
      body.data.responseTemplateGroups,
    );
    if (!validated.ok) {
      return c.json(
        { error: "invalid_response_templates", message: validated.message },
        400,
      );
    }
    responseTemplateGroups = validated.normalized;
  }

  let handoffTopicGroups = existing.handoff_topic_groups;
  if (body.data.handoffTopicGroups !== undefined) {
    const validated = await validateHandoffTopicGroupIdsForWorkspace(
      workspaceId,
      body.data.handoffTopicGroups,
    );
    if (!validated.ok) {
      return c.json(
        { error: "invalid_handoff_topic_groups", message: validated.message },
        400,
      );
    }
    handoffTopicGroups = validated.normalized;
  }

  let contextGroups = existing.context_groups;
  if (body.data.contextGroups !== undefined) {
    const validated = await validateContextGroupIdsForWorkspace(
      workspaceId,
      body.data.contextGroups,
    );
    if (!validated.ok) {
      return c.json(
        { error: "invalid_context_groups", message: validated.message },
        400,
      );
    }
    contextGroups = validated.normalized;
  }

  let assetGroups = existing.asset_groups;
  if (body.data.assetGroups !== undefined) {
    const validated = await validateAssetGroupIdsForWorkspace(
      workspaceId,
      body.data.assetGroups,
    );
    if (!validated.ok) {
      return c.json(
        { error: "invalid_asset_groups", message: validated.message },
        400,
      );
    }
    assetGroups = validated.normalized;
  }

  await updateAgentConfig({
    id: agentId,
    workspace_id: workspaceId,
    profile_name: body.data.profileName,
    behavior: body.data.behavior,
    tools: normalizedTools,
    skills: normalizedSkills,
    auto_assign_conversation_labels: body.data.autoAssignConversationLabels,
    response_template_groups: responseTemplateGroups,
    handoff_topic_groups: handoffTopicGroups,
    context_groups: contextGroups,
    asset_groups: assetGroups,
  });
  if (body.data.attachedConnectionIds !== undefined) {
    await syncAgentWhatsappConnections(
      workspaceId,
      agentId,
      body.data.attachedConnectionIds,
    );
  }
  return c.json({ ok: true });
});

const workspaceHandoffTopicEntryBodySchema = z
  .object({
    topic: z.string().max(HANDOFF_TOPIC_TITLE_MAX_LEN + 20),
    description: z.string().max(HANDOFF_TOPIC_DESCRIPTION_MAX_LEN + 20),
  })
  .strict();

const patchHandoffTopicGroupNameSchema = z
  .object({ name: z.string().max(HANDOFF_TOPIC_GROUP_NAME_MAX_LEN + 20) })
  .strict();

app.get("/handoff-topic-groups", async (c) => {
  const workspaceId = c.get("workspaceId");
  const groups = await listWorkspaceHandoffTopicGroupSummaries(workspaceId);
  return c.json({ groups });
});

app.get("/handoff-topic-groups/:id", async (c) => {
  const workspaceId = c.get("workspaceId");
  const groupId = c.req.param("id");
  const group = await getWorkspaceHandoffTopicGroupDetail(workspaceId, groupId);
  if (!group) return c.json({ error: "not_found" }, 404);
  return c.json({ group });
});

app.patch("/handoff-topic-groups/:id", async (c) => {
  const workspaceId = c.get("workspaceId");
  const groupId = c.req.param("id");
  const parsed = patchHandoffTopicGroupNameSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "Invalid payload" }, 400);

  const outcome = await updateWorkspaceHandoffTopicGroupName({
    workspaceId,
    groupId,
    name: parsed.data.name,
  });

  if (!outcome.ok) {
    return c.json({ error: "update_failed", message: outcome.message }, 400);
  }
  return c.json({ ok: true });
});

app.post("/handoff-topic-groups/:id/entries", async (c) => {
  const workspaceId = c.get("workspaceId");
  const groupId = c.req.param("id");
  const parsed = workspaceHandoffTopicEntryBodySchema.safeParse(
    await c.req.json(),
  );
  if (!parsed.success) return c.json({ error: "Invalid payload" }, 400);

  const outcome = await addWorkspaceHandoffTopicEntry({
    workspaceId,
    groupId,
    topic: parsed.data.topic,
    description: parsed.data.description,
  });

  if (!outcome.ok)
    return c.json({ error: "create_failed", message: outcome.message }, 400);
  return c.json({ entry: outcome.entry });
});

app.patch("/handoff-topic-groups/:id/entries/:entryId", async (c) => {
  const workspaceId = c.get("workspaceId");
  const groupId = c.req.param("id");
  const entryId = c.req.param("entryId");
  const parsed = workspaceHandoffTopicEntryBodySchema.safeParse(
    await c.req.json(),
  );
  if (!parsed.success) return c.json({ error: "Invalid payload" }, 400);

  const outcome = await updateWorkspaceHandoffTopicEntry({
    workspaceId,
    groupId,
    entryId,
    topic: parsed.data.topic,
    description: parsed.data.description,
  });

  if (!outcome.ok)
    return c.json({ error: "update_failed", message: outcome.message }, 400);
  return c.json({ ok: true });
});

app.delete("/handoff-topic-groups/:id/entries/:entryId", async (c) => {
  const workspaceId = c.get("workspaceId");
  const groupId = c.req.param("id");
  const entryId = c.req.param("entryId");
  const outcome = await deleteWorkspaceHandoffTopicEntry({
    workspaceId,
    groupId,
    entryId,
  });
  if (!outcome.ok)
    return c.json({ error: "delete_failed", message: outcome.message }, 400);
  return c.json({ ok: true });
});

const createHandoffTopicGroupSchema = z
  .object({ name: z.string().max(HANDOFF_TOPIC_GROUP_NAME_MAX_LEN + 20) })
  .strict();

app.post("/handoff-topic-groups", async (c) => {
  const workspaceId = c.get("workspaceId");
  const parsed = createHandoffTopicGroupSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "Invalid payload" }, 400);
  const name = parsed.data.name.trim();
  if (name.length === 0)
    return c.json(
      { error: "name_required", message: "Group name is required." },
      400,
    );

  const result = await createWorkspaceHandoffTopicGroup(workspaceId, name);
  if (!result.ok)
    return c.json({ error: "create_failed", message: result.message }, 400);
  return c.json({ id: result.id });
});

app.delete("/handoff-topic-groups/:id", async (c) => {
  const workspaceId = c.get("workspaceId");
  const groupId = c.req.param("id");
  const outcome = await deleteWorkspaceHandoffTopicGroup(workspaceId, groupId);
  if (!outcome.ok)
    return c.json({ error: "delete_failed", message: outcome.message }, 400);
  return c.json({ ok: true });
});

const workspaceResponseTemplateEntryBodySchema = z
  .object({
    questionText: z.string().max(1000),
    answerText: z.string().max(4000),
  })
  .strict();

const patchResponseTemplateGroupNameSchema = z
  .object({ name: z.string().max(130) })
  .strict();

app.get("/response-template-groups", async (c) => {
  const workspaceId = c.get("workspaceId");
  const groups = await listWorkspaceResponseTemplateGroupSummaries(workspaceId);
  return c.json({ groups });
});

app.get("/response-template-groups/:id", async (c) => {
  const workspaceId = c.get("workspaceId");
  const groupId = c.req.param("id");
  const group = await getWorkspaceResponseTemplateGroupDetail(
    workspaceId,
    groupId,
  );
  if (!group) return c.json({ error: "not_found" }, 404);
  return c.json({ group });
});

app.patch("/response-template-groups/:id", async (c) => {
  const workspaceId = c.get("workspaceId");
  const groupId = c.req.param("id");
  const parsed = patchResponseTemplateGroupNameSchema.safeParse(
    await c.req.json(),
  );
  if (!parsed.success) return c.json({ error: "Invalid payload" }, 400);

  const outcome = await updateWorkspaceResponseTemplateGroupName({
    workspaceId,
    groupId,
    name: parsed.data.name,
  });

  if (!outcome.ok) {
    return c.json({ error: "update_failed", message: outcome.message }, 400);
  }
  return c.json({ ok: true });
});

app.post("/response-template-groups/:id/entries", async (c) => {
  const workspaceId = c.get("workspaceId");
  const groupId = c.req.param("id");
  const parsed = workspaceResponseTemplateEntryBodySchema.safeParse(
    await c.req.json(),
  );
  if (!parsed.success) return c.json({ error: "Invalid payload" }, 400);

  const outcome = await addWorkspaceResponseTemplateEntry({
    workspaceId,
    groupId,
    questionText: parsed.data.questionText,
    answerText: parsed.data.answerText,
  });

  if (!outcome.ok)
    return c.json({ error: "create_failed", message: outcome.message }, 400);
  return c.json({ entry: outcome.entry });
});

app.patch("/response-template-groups/:id/entries/:entryId", async (c) => {
  const workspaceId = c.get("workspaceId");
  const groupId = c.req.param("id");
  const entryId = c.req.param("entryId");
  const parsed = workspaceResponseTemplateEntryBodySchema.safeParse(
    await c.req.json(),
  );
  if (!parsed.success) return c.json({ error: "Invalid payload" }, 400);

  const outcome = await updateWorkspaceResponseTemplateEntry({
    workspaceId,
    groupId,
    entryId,
    questionText: parsed.data.questionText,
    answerText: parsed.data.answerText,
  });

  if (!outcome.ok)
    return c.json({ error: "update_failed", message: outcome.message }, 400);
  return c.json({ ok: true });
});

app.delete("/response-template-groups/:id/entries/:entryId", async (c) => {
  const workspaceId = c.get("workspaceId");
  const groupId = c.req.param("id");
  const entryId = c.req.param("entryId");
  const outcome = await deleteWorkspaceResponseTemplateEntry({
    workspaceId,
    groupId,
    entryId,
  });
  if (!outcome.ok)
    return c.json({ error: "delete_failed", message: outcome.message }, 400);
  return c.json({ ok: true });
});

const createResponseTemplateGroupSchema = z
  .object({ name: z.string().max(130) })
  .strict();

app.post("/response-template-groups", async (c) => {
  const workspaceId = c.get("workspaceId");
  const parsed = createResponseTemplateGroupSchema.safeParse(
    await c.req.json(),
  );
  if (!parsed.success) return c.json({ error: "Invalid payload" }, 400);
  const name = parsed.data.name.trim();
  if (name.length === 0)
    return c.json(
      { error: "name_required", message: "Group name is required." },
      400,
    );

  const result = await createWorkspaceResponseTemplateGroup(workspaceId, name);
  if (!result.ok)
    return c.json({ error: "create_failed", message: result.message }, 400);
  return c.json({ id: result.id });
});

app.delete("/response-template-groups/:id", async (c) => {
  const workspaceId = c.get("workspaceId");
  const groupId = c.req.param("id");
  const outcome = await deleteWorkspaceResponseTemplateGroup(
    workspaceId,
    groupId,
  );
  if (!outcome.ok)
    return c.json({ error: "delete_failed", message: outcome.message }, 400);
  return c.json({ ok: true });
});

const workspaceContextEntryBodySchema = z
  .object({
    title: z.string().max(CONTEXT_TITLE_MAX_LEN + 20),
    bodyText: z.string().max(CONTEXT_BODY_MAX_LEN + 20),
  })
  .strict();

const patchWorkspaceContextGroupNameSchema = z
  .object({ name: z.string().max(CONTEXT_GROUP_NAME_MAX_LEN + 20) })
  .strict();

app.get("/workspace-context-groups", async (c) => {
  const workspaceId = c.get("workspaceId");
  const groups = await listWorkspaceContextGroupSummaries(workspaceId);
  return c.json({ groups });
});

app.get("/workspace-context-groups/:id", async (c) => {
  const workspaceId = c.get("workspaceId");
  const groupId = c.req.param("id");
  const group = await getWorkspaceContextGroupDetail(workspaceId, groupId);
  if (!group) return c.json({ error: "not_found" }, 404);
  return c.json({ group });
});

app.patch("/workspace-context-groups/:id", async (c) => {
  const workspaceId = c.get("workspaceId");
  const groupId = c.req.param("id");
  const parsed = patchWorkspaceContextGroupNameSchema.safeParse(
    await c.req.json(),
  );
  if (!parsed.success) return c.json({ error: "Invalid payload" }, 400);

  const outcome = await updateWorkspaceContextGroupName({
    workspaceId,
    groupId,
    name: parsed.data.name,
  });

  if (!outcome.ok) {
    return c.json({ error: "update_failed", message: outcome.message }, 400);
  }
  return c.json({ ok: true });
});

app.post("/workspace-context-groups/:id/entries", async (c) => {
  const workspaceId = c.get("workspaceId");
  const groupId = c.req.param("id");
  const parsed = workspaceContextEntryBodySchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "Invalid payload" }, 400);

  const outcome = await addWorkspaceContextEntry({
    workspaceId,
    groupId,
    title: parsed.data.title,
    bodyText: parsed.data.bodyText,
  });

  if (!outcome.ok)
    return c.json({ error: "create_failed", message: outcome.message }, 400);
  return c.json({ entry: outcome.entry });
});

app.patch("/workspace-context-groups/:id/entries/:entryId", async (c) => {
  const workspaceId = c.get("workspaceId");
  const groupId = c.req.param("id");
  const entryId = c.req.param("entryId");
  const parsed = workspaceContextEntryBodySchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "Invalid payload" }, 400);

  const outcome = await updateWorkspaceContextEntry({
    workspaceId,
    groupId,
    entryId,
    title: parsed.data.title,
    bodyText: parsed.data.bodyText,
  });

  if (!outcome.ok)
    return c.json({ error: "update_failed", message: outcome.message }, 400);
  return c.json({ ok: true });
});

app.delete("/workspace-context-groups/:id/entries/:entryId", async (c) => {
  const workspaceId = c.get("workspaceId");
  const groupId = c.req.param("id");
  const entryId = c.req.param("entryId");
  const outcome = await deleteWorkspaceContextEntry({
    workspaceId,
    groupId,
    entryId,
  });
  if (!outcome.ok)
    return c.json({ error: "delete_failed", message: outcome.message }, 400);
  return c.json({ ok: true });
});

const createWorkspaceContextGroupSchema = z
  .object({ name: z.string().max(CONTEXT_GROUP_NAME_MAX_LEN + 20) })
  .strict();

app.post("/workspace-context-groups", async (c) => {
  const workspaceId = c.get("workspaceId");
  const parsed = createWorkspaceContextGroupSchema.safeParse(
    await c.req.json(),
  );
  if (!parsed.success) return c.json({ error: "Invalid payload" }, 400);
  const name = parsed.data.name.trim();
  if (name.length === 0)
    return c.json(
      { error: "name_required", message: "Group name is required." },
      400,
    );

  const result = await createWorkspaceContextGroup(workspaceId, name);
  if (!result.ok)
    return c.json({ error: "create_failed", message: result.message }, 400);
  return c.json({ id: result.id });
});

app.delete("/workspace-context-groups/:id", async (c) => {
  const workspaceId = c.get("workspaceId");
  const groupId = c.req.param("id");
  const outcome = await deleteWorkspaceContextGroup(workspaceId, groupId);
  if (!outcome.ok)
    return c.json({ error: "delete_failed", message: outcome.message }, 400);
  return c.json({ ok: true });
});

app.post("/agents/:id/archive", async (c) => {
  const workspaceId = c.get("workspaceId");
  const agentId = c.req.param("id");
  const bound = await listConnectionsByAgentConfigId(workspaceId, agentId);
  if (bound.length > 0) return c.json({ error: "whatsapp_detach_required" }, 409);
  const config = await getAgentConfigById(workspaceId, agentId);
  if (!config) return c.json({ error: "agent_not_found" }, 404);
  if (config.first_used_at)
    return c.json({ error: "cannot_archive_used" }, 422);
  const result = await archiveAgentConfig({
    workspace_id: workspaceId,
    id: agentId,
  });
  if (!result.ok) return c.json({ error: result.message }, 500);
  return c.json({ ok: true });
});

app.post("/agents/:id/knowledge-import/preview", async (c) => {
  const workspaceId = c.get("workspaceId");
  const agentId = c.req.param("id");
  const agent = await getAgentConfigById(workspaceId, agentId);
  if (!agent) return c.json({ error: "agent_not_found" }, 404);

  const contentType = c.req.header("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    return c.json({ error: "multipart_required" }, 415);
  }

  const formData = await c.req.formData();
  const files = formData.getAll("files").filter((entry) => typeof entry !== "string") as File[];
  const result = await runAgentKnowledgeImportPreview({
    workspaceId,
    agentId,
    profileName: String(formData.get("profileName") ?? agent.profile_name),
    focusHint: String(formData.get("focusHint") ?? ""),
    targetsJson: String(formData.get("targets") ?? "[]"),
    files,
  });

  if (!result.ok) {
    return c.json({ error: "import_preview_failed", message: result.message }, 400);
  }

  return c.json({ ok: true, draft: result.draft });
});

app.get("/agents/:id/knowledge-import/jobs", async (c) => {
  const workspaceId = c.get("workspaceId");
  const agentId = c.req.param("id");
  const agent = await getAgentConfigById(workspaceId, agentId);
  if (!agent) return c.json({ error: "agent_not_found" }, 404);

  const result = await listAgentKnowledgeImportJobs(workspaceId, agentId);
  return c.json(result);
});

app.get("/agents/:id/knowledge-import/jobs/:jobId", async (c) => {
  const workspaceId = c.get("workspaceId");
  const agentId = c.req.param("id");
  const jobId = c.req.param("jobId");
  const agent = await getAgentConfigById(workspaceId, agentId);
  if (!agent) return c.json({ error: "agent_not_found" }, 404);

  const result = await getAgentKnowledgeImportJob(workspaceId, agentId, jobId);
  if (!result.ok) return c.json({ error: "import_job_not_found", message: result.message }, 404);
  return c.json({ ok: true, job: result.job });
});

app.post("/agents/:id/knowledge-import/jobs", async (c) => {
  const workspaceId = c.get("workspaceId");
  const agentId = c.req.param("id");
  const agent = await getAgentConfigById(workspaceId, agentId);
  if (!agent) return c.json({ error: "agent_not_found" }, 404);

  const contentType = c.req.header("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    return c.json({ error: "multipart_required" }, 415);
  }

  const formData = await c.req.formData();
  const files = formData.getAll("files").filter((entry) => typeof entry !== "string") as File[];
  const result = await startAgentKnowledgeImportJob({
    workspaceId,
    agentId,
    profileName: String(formData.get("profileName") ?? agent.profile_name),
    focusHint: String(formData.get("focusHint") ?? ""),
    targetsJson: String(formData.get("targets") ?? "[]"),
    files,
  });

  if (!result.ok) {
    if (result.error === "import_job_already_active") {
      return c.json(
        { error: "import_job_already_active", message: result.message, jobId: result.jobId },
        409,
      );
    }
    return c.json({ error: "import_job_failed", message: result.message }, 400);
  }

  return c.json({ ok: true, job: result.job });
});

app.patch("/agents/:id/knowledge-import/jobs/:jobId", async (c) => {
  const workspaceId = c.get("workspaceId");
  const agentId = c.req.param("id");
  const jobId = c.req.param("jobId");
  const agent = await getAgentConfigById(workspaceId, agentId);
  if (!agent) return c.json({ error: "agent_not_found" }, 404);

  const body = await c.req.json();
  const result = await saveAgentKnowledgeImportJobProgress({
    workspaceId,
    agentId,
    jobId,
    draft: body.draft,
    selection: body.selection,
    workspaceRefs: body.workspaceRefs,
  });

  if (!result.ok) {
    return c.json({ error: "import_job_save_failed", message: result.message }, 400);
  }

  return c.json({ ok: true });
});

app.post("/agents/:id/knowledge-import/jobs/:jobId/dismiss", async (c) => {
  const workspaceId = c.get("workspaceId");
  const agentId = c.req.param("id");
  const jobId = c.req.param("jobId");
  const agent = await getAgentConfigById(workspaceId, agentId);
  if (!agent) return c.json({ error: "agent_not_found" }, 404);

  const result = await dismissAgentKnowledgeImportJobForAgent(workspaceId, agentId, jobId);
  if (!result.ok) {
    return c.json({ error: "import_job_dismiss_failed", message: result.message }, 400);
  }

  return c.json({ ok: true });
});

app.post("/agents/:id/knowledge-import/apply", async (c) => {
  const workspaceId = c.get("workspaceId");
  const agentId = c.req.param("id");
  const agent = await getAgentConfigById(workspaceId, agentId);
  if (!agent) return c.json({ error: "agent_not_found" }, 404);

  const result = await runAgentKnowledgeImportApply({
    workspaceId,
    agentId,
    body: await c.req.json(),
  });

  if (!result.ok) {
    return c.json({ error: "import_apply_failed", message: result.message }, 400);
  }

  return c.json({ ok: true, workspaceRefs: result.workspaceRefs });
});

app.delete("/agents/:id", async (c) => {
  const workspaceId = c.get("workspaceId");
  const agentId = c.req.param("id");
  const bound = await listConnectionsByAgentConfigId(workspaceId, agentId);
  if (bound.length > 0) return c.json({ error: "whatsapp_detach_required" }, 409);
  const config = await getAgentConfigById(workspaceId, agentId);
  if (!config) return c.json({ error: "agent_not_found" }, 404);
  if (config.first_used_at) return c.json({ error: "cannot_delete_used" }, 422);
  const result = await deleteAgentConfig({
    workspace_id: workspaceId,
    id: agentId,
  });
  if (!result.ok) return c.json({ error: result.message }, 500);
  return c.json({ ok: true });
});

app.get("/workspace-asset-groups", async (c) => {
  const workspaceId = c.get("workspaceId");
  const groups = await listWorkspaceAssetGroupSummaries(workspaceId);
  return c.json({ groups });
});

app.get("/workspace-asset-groups/:id", async (c) => {
  const workspaceId = c.get("workspaceId");
  const group = await getWorkspaceAssetGroupDetail(workspaceId, c.req.param("id"));
  if (!group) return c.json({ error: "asset_group_not_found" }, 404);
  return c.json({ group });
});

app.patch("/workspace-asset-groups/:id", async (c) => {
  const workspaceId = c.get("workspaceId");
  const groupId = c.req.param("id");
  const body = (await c.req.json()) as { name?: string };
  const name = body.name?.trim() ?? "";
  if (!name) return c.json({ error: "name_required" }, 400);
  const result = await updateWorkspaceAssetGroupName({ workspaceId, groupId, name });
  if (!result.ok) return c.json({ error: "update_failed", message: result.message }, 400);
  return c.json({ ok: true });
});

app.post("/workspace-asset-groups", async (c) => {
  const workspaceId = c.get("workspaceId");
  const body = (await c.req.json()) as { name?: string };
  const name = body.name?.trim() ?? "";
  if (!name) return c.json({ error: "name_required" }, 400);
  if (name.length > ASSET_GROUP_NAME_MAX_LEN) {
    return c.json({ error: "name_too_long" }, 400);
  }
  const result = await createWorkspaceAssetGroup(workspaceId, name);
  if (!result.ok) return c.json({ error: "create_failed", message: result.message }, 400);
  return c.json({ id: result.id });
});

app.delete("/workspace-asset-groups/:id", async (c) => {
  const workspaceId = c.get("workspaceId");
  const result = await deleteWorkspaceAssetGroup(workspaceId, c.req.param("id"));
  if (!result.ok) return c.json({ error: "delete_failed", message: result.message }, 400);
  return c.json({ ok: true });
});

app.post("/workspace-asset-groups/:id/assets", async (c) => {
  const workspaceId = c.get("workspaceId");
  const groupId = c.req.param("id");
  const formData = await c.req.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) return c.json({ error: "file_required" }, 400);
  const description = String(formData.get("description") ?? "").trim();
  const data = await file.arrayBuffer();
  const result = await createAgentAssetInGroup({
    workspaceId,
    groupId,
    fileName: file.name || "asset",
    mimeType: file.type || "application/octet-stream",
    description,
    data,
  });
  if (!result.ok) {
    const status =
      result.message.includes("At most") ||
      result.message.includes("storage is full") ||
      result.message.includes("remaining")
        ? 422
        : 400;
    return c.json({ error: "asset_upload_failed", message: result.message }, status);
  }
  return c.json({ asset: result.asset });
});

const updateAgentAssetSchema = z.object({
  description: z.string().max(2000),
});

app.patch("/workspace-asset-groups/:id/assets/:assetId", async (c) => {
  const workspaceId = c.get("workspaceId");
  const groupId = c.req.param("id");
  const assetId = c.req.param("assetId");
  const parsed = updateAgentAssetSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "Invalid payload" }, 400);
  const result = await updateAgentAssetDescription({
    workspaceId,
    groupId,
    assetId,
    description: parsed.data.description,
  });
  if (!result.ok) return c.json({ error: "asset_update_failed", message: result.message }, 400);
  return c.json({ ok: true });
});

app.delete("/workspace-asset-groups/:id/assets/:assetId", async (c) => {
  const workspaceId = c.get("workspaceId");
  const groupId = c.req.param("id");
  const assetId = c.req.param("assetId");
  const result = await deleteAgentAssetFromGroup({ workspaceId, groupId, assetId });
  if (!result.ok) return c.json({ error: "asset_delete_failed", message: result.message }, 400);
  return c.json({ ok: true });
});

app.get("/custom-tools", async (c) => {
  const workspaceId = c.get("workspaceId");
  const tools = await listWorkspaceCustomTools(workspaceId);
  return c.json({ tools });
});

app.get("/custom-tools/:id", async (c) => {
  const workspaceId = c.get("workspaceId");
  const tool = await getWorkspaceCustomToolById(workspaceId, c.req.param("id"));
  if (!tool) return c.json({ error: "tool_not_found" }, 404);
  return c.json({ tool });
});

app.post("/custom-tools", async (c) => {
  const workspaceId = c.get("workspaceId");
  const body = (await c.req.json()) as {
    displayName?: string;
    description?: string;
    sourceCode?: string;
    requiredEnv?: string[];
  };
  if (!body.displayName?.trim() || !body.sourceCode?.trim()) {
    return c.json({ error: "tool_name_and_source_required" }, 400);
  }
  const result = await upsertWorkspaceCustomTool({
    workspaceId,
    displayName: body.displayName,
    description: body.description ?? "",
    sourceCode: body.sourceCode,
    requiredEnv: body.requiredEnv,
  });
  if (!result.ok || !result.toolId) {
    return c.json({ error: result.message || "create_tool_failed" }, 400);
  }
  return c.json({ toolId: result.toolId });
});

app.put("/custom-tools/:id", async (c) => {
  const workspaceId = c.get("workspaceId");
  const toolId = c.req.param("id");
  const current = await getWorkspaceCustomToolById(workspaceId, toolId);
  if (!current) return c.json({ error: "tool_not_found" }, 404);
  const body = (await c.req.json()) as {
    displayName?: string;
    description?: string;
    sourceCode?: string;
    requiredEnv?: string[];
    testInput?: string;
    isActive?: boolean;
  };
  const result = await upsertWorkspaceCustomTool({
    workspaceId,
    toolId,
    displayName: body.displayName ?? current.display_name,
    description: body.description ?? current.description,
    sourceCode: body.sourceCode ?? current.source_code,
    requiredEnv: body.requiredEnv ?? current.required_env,
    testInput: body.testInput ?? current.test_input,
    isActive: body.isActive ?? current.is_active,
  });
  if (!result.ok) {
    return c.json({ error: result.message || "update_tool_failed" }, 400);
  }
  return c.json({ ok: true });
});

app.delete("/custom-tools/:id", async (c) => {
  const workspaceId = c.get("workspaceId");
  const result = await deleteWorkspaceCustomTool({
    workspaceId,
    toolId: c.req.param("id"),
  });
  if (!result.ok) {
    return c.json({ error: result.message || "delete_tool_failed" }, 400);
  }
  return c.json({ ok: true });
});

app.post("/custom-tools/:id/test", async (c) => {
  const workspaceId = c.get("workspaceId");
  const tool = await getWorkspaceCustomToolById(workspaceId, c.req.param("id"));
  if (!tool) return c.json({ error: "tool_not_found" }, 404);
  const body = (await c.req.json()) as {
    input?: unknown;
    sourceCode?: string;
    requiredEnv?: string[];
  };

  let requiredEnv = tool.required_env;
  if (body.requiredEnv) {
    try {
      requiredEnv = normalizeRequiredEnvNames(body.requiredEnv);
    } catch (error) {
      return c.json({ result: { ok: false, error: String(error) } });
    }
  }

  const source = body.sourceCode?.trim()
    ? stripLegacyToolExports(body.sourceCode)
    : tool.source_code;
  const sourceHash = hashCustomToolSource(source);
  const envVars = await resolveCustomToolEnv(workspaceId, requiredEnv);
  const missing = requiredEnv.filter((name) => !envVars[name]);
  if (missing.length > 0) {
    return c.json({
      result: {
        ok: false,
        error: `Missing workspace secrets: ${missing.join(", ")}. Add values in Settings → Secrets and list each name under Required env.`,
      },
    });
  }

  const result = await runCustomTool({
    source,
    sourceHash,
    input: body.input ?? {},
    context: { workspaceId, sessionId: "test-session" },
    env: envVars,
  });
  return c.json({ result });
});

app.get("/secrets", async (c) => {
  const workspaceId = c.get("workspaceId");
  const secrets = await listWorkspaceSecrets(workspaceId);
  return c.json({ secrets });
});

app.post("/secrets", async (c) => {
  const workspaceId = c.get("workspaceId");
  const body = (await c.req.json()) as {
    name?: string;
    description?: string;
    value?: string;
  };
  if (!body.name?.trim() || !body.value?.trim()) {
    return c.json({ error: "secret_name_and_value_required" }, 400);
  }
  const result = await createWorkspaceSecret({
    workspaceId,
    name: body.name,
    description: body.description ?? "",
    value: body.value,
  });
  if (!result.ok || !result.secretId) {
    return c.json({ error: result.message || "create_secret_failed" }, 400);
  }
  return c.json({ secretId: result.secretId, value: body.value });
});

app.put("/secrets/:id", async (c) => {
  const workspaceId = c.get("workspaceId");
  const secretId = c.req.param("id");
  const current = await getWorkspaceSecretById(workspaceId, secretId);
  if (!current) return c.json({ error: "secret_not_found" }, 404);
  const body = (await c.req.json()) as {
    description?: string;
    value?: string;
  };
  if (!body.value?.trim()) {
    return c.json({ error: "secret_value_required" }, 400);
  }
  const result = await updateWorkspaceSecretValue({
    workspaceId,
    secretId,
    description: body.description,
    value: body.value,
  });
  if (!result.ok) {
    return c.json({ error: result.message || "update_secret_failed" }, 400);
  }
  return c.json({ ok: true, value: body.value });
});

app.delete("/secrets/:id", async (c) => {
  const workspaceId = c.get("workspaceId");
  const result = await deleteWorkspaceSecret({
    workspaceId,
    secretId: c.req.param("id"),
  });
  if (!result.ok) {
    return c.json({ error: result.message || "delete_secret_failed" }, 400);
  }
  return c.json({ ok: true });
});

// ── Skills ──────────────────────────────────────────────────────────────────

app.get("/skills", async (c) => {
  const workspaceId = c.get("workspaceId");
  const skills = await listWorkspaceSkills(workspaceId);
  return c.json({ skills });
});

app.get("/skills/:id", async (c) => {
  const workspaceId = c.get("workspaceId");
  const skill = await getWorkspaceSkillById(workspaceId, c.req.param("id"));
  if (!skill) return c.json({ error: "skill_not_found" }, 404);
  const content = await readWorkspaceSkillContent(
    workspaceId,
    skill.storage_path,
  );
  return c.json({ skill, content });
});

app.post("/skills", async (c) => {
  const workspaceId = c.get("workspaceId");
  const { displayName, description, content } = (await c.req.json()) as {
    displayName: string;
    description: string;
    content: string;
  };
  if (!displayName || !content)
    return c.json({ error: "skill_name_and_content_required" }, 400);
  const result = await createWorkspaceSkill({
    workspaceId,
    displayName,
    description,
    content,
  });
  if (!result.ok || !result.skillId)
    return c.json({ error: result.message || "create_skill_failed" }, 500);
  return c.json({ skillId: result.skillId });
});

app.put("/skills/:id", async (c) => {
  const workspaceId = c.get("workspaceId");
  const skillId = c.req.param("id");
  const current = await getWorkspaceSkillById(workspaceId, skillId);
  if (!current) return c.json({ error: "skill_not_found" }, 404);
  const body = (await c.req.json()) as {
    displayName?: string;
    description?: string;
    content?: string;
    isActive?: boolean;
  };
  const displayName = body.displayName ?? current.display_name;
  const description = body.description ?? current.description;
  const contentRaw = body.content?.trim() ?? "";
  const existingContent = await readWorkspaceSkillContent(
    workspaceId,
    current.storage_path,
  );
  const content = contentRaw.length > 0 ? contentRaw : (existingContent ?? "");
  if (!content) return c.json({ error: "skill_content_required" }, 400);
  const result = await updateWorkspaceSkill({
    workspaceId,
    skillId,
    displayName,
    description,
    content,
    isActive: body.isActive ?? true,
  });
  if (!result.ok)
    return c.json({ error: result.message || "update_skill_failed" }, 500);
  return c.json({ ok: true });
});

app.delete("/skills/:id", async (c) => {
  const workspaceId = c.get("workspaceId");
  const skillId = c.req.param("id");
  const result = await deleteWorkspaceSkill({ workspaceId, skillId });
  if (!result.ok)
    return c.json({ error: result.message || "delete_skill_failed" }, 500);
  return c.json({ ok: true });
});

// ── Connections (WhatsApp) ──────────────────────────────────────────────────

app.get("/connections", async (c) => {
  const workspaceId = c.get("workspaceId");
  const [connections, events] = await Promise.all([
    listConnections(workspaceId),
    listRecentConnectionEvents(workspaceId),
  ]);
  return c.json({
    connections,
    events,
    canCreateConnection: true,
    connectionUnavailableReason: null,
  });
});

const createConnectionBodySchema = z.object({
  displayName: z.string().max(WHATSAPP_CONNECTION_DISPLAY_NAME_MAX_LEN).optional(),
});

app.post("/connections", async (c) => {
  const workspaceId = c.get("workspaceId");
  const parsedBody = createConnectionBodySchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsedBody.success) return c.json({ error: "Invalid payload" }, 400);
  const displayName = parsedBody.data.displayName ?? "Primary Device";

  const created = await createConnection({
    workspaceId,
    displayName,
    webhookToken: crypto.randomUUID(),
  });
  if (!created.ok || !created.id) {
    if (created.message === "display_name_too_long")
      return c.json({ error: "display_name_too_long" }, 400);
    return c.json({ error: "connection_create_failed" }, 500);
  }

  try {
    await startConnection(created.id);
  } catch (error) {
    console.error(`[user/connections] whatsapp session start failed: ${String(error)}`);
    return c.json({ error: "whatsapp_unavailable" }, 503);
  }

  let qrResponse: Awaited<ReturnType<typeof waitForQrCode>>;
  try {
    qrResponse = await waitForQrCode(created.id);
  } catch (error) {
    console.error(`[user/connections] qr fetch failed: ${String(error)}`);
    return c.json({ error: "whatsapp_unavailable" }, 503);
  }
  const qrPayload = qrResponse.type === "qrCode" ? qrResponse.message : null;

  await updateConnectionSyncState(workspaceId, created.id, {
    status:
      qrResponse.type === "alreadyLogged"
        ? "authorized"
        : qrResponse.type === "qrCode"
          ? "pending_qr"
          : "error",
    qrCodePayload: qrPayload,
  });
  await recordConnectionEvent({
    workspaceId,
    connectionIdSnapshot: created.id,
    displayName,
    phoneNumber: null,
    eventType: "connection_created",
    source: "user",
    stateInstance:
      qrResponse.type === "alreadyLogged" ? "authorized" : "pending_qr",
    statusInstance: null,
    message: "WhatsApp connection setup started.",
  });
  return c.json({ id: created.id });
});

app.post("/connections/:id/refresh-qr", async (c) => {
  const workspaceId = c.get("workspaceId");
  const connectionId = c.req.param("id");
  const connection = await getConnectionById(workspaceId, connectionId);
  if (!connection) return c.json({ error: "connection_not_found" }, 404);
  const qrResult = await waitForQrCode(connectionId);
  await updateConnectionSyncState(workspaceId, connectionId, {
    status: qrResult.type === "alreadyLogged" ? "authorized" : "pending_qr",
    qrCodePayload: qrResult.type === "qrCode" ? qrResult.message : null,
  });
  return c.json({ ok: true });
});

app.post("/connections/:id/reconnect", async (c) => {
  const workspaceId = c.get("workspaceId");
  const connectionId = c.req.param("id");
  const connection = await getConnectionById(workspaceId, connectionId);
  if (!connection) return c.json({ error: "connection_not_found" }, 404);

  await logoutConnection(connectionId);
  await restartConnection(connectionId);
  const qr = await waitForQrCode(connectionId);
  await updateConnectionSyncState(workspaceId, connectionId, {
    status: "pending_qr",
    qrCodePayload: qr.type === "qrCode" ? qr.message : null,
    stateInstance: "notAuthorized",
  });
  return c.json({ ok: true, activeConnectionId: connectionId });
});

const patchConnectionModeSchema = z.object({
  mode: z.enum(["inactive", "testing", "live"]),
});

app.patch("/connections/:id/mode", async (c) => {
  const workspaceId = c.get("workspaceId");
  const connectionId = c.req.param("id");
  const parsed = patchConnectionModeSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "Invalid payload" }, 400);
  const connection = await getConnectionById(workspaceId, connectionId);
  if (!connection) return c.json({ error: "connection_not_found" }, 404);
  const result = await updateConnectionMode(
    workspaceId,
    connectionId,
    parsed.data.mode,
  );
  if (!result.ok) return c.json({ error: "update_failed" }, 500);
  return c.json({ ok: true, mode: parsed.data.mode });
});

const patchConnectionDisplayNameSchema = z.object({
  displayName: z.string().min(1).max(WHATSAPP_CONNECTION_DISPLAY_NAME_MAX_LEN),
});

app.patch("/connections/:id", async (c) => {
  const workspaceId = c.get("workspaceId");
  const connectionId = c.req.param("id");
  const parsed = patchConnectionDisplayNameSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "Invalid payload" }, 400);
  const connection = await getConnectionById(workspaceId, connectionId);
  if (!connection) return c.json({ error: "connection_not_found" }, 404);
  const result = await updateConnectionDisplayName(
    workspaceId,
    connectionId,
    parsed.data.displayName,
  );
  if (!result.ok) {
    if (result.code === "empty") return c.json({ error: "display_name_required" }, 400);
    if (result.code === "too_long") return c.json({ error: "display_name_too_long" }, 400);
    return c.json({ error: "update_failed" }, 500);
  }
  return c.json({ ok: true, displayName: result.displayName ?? parsed.data.displayName });
});

app.delete("/connections/:id", async (c) => {
  const workspaceId = c.get("workspaceId");
  const connectionId = c.req.param("id");
  const connection = await getConnectionById(workspaceId, connectionId);
  if (!connection) return c.json({ error: "connection_not_found" }, 404);

  try {
    await destroyConnection(connectionId);
  } catch (error) {
    console.error(`[user/connections/delete] whatsapp teardown failed: ${String(error)}`);
  }

  const deleted = await deleteConnectionByWorkspace(workspaceId, connectionId);
  if (!deleted.ok) return c.json({ error: "connection_delete_failed" }, 500);
  if (!deleted.deleted) return c.json({ error: "connection_not_found" }, 404);

  await recordConnectionEvent({
    workspaceId,
    connectionIdSnapshot: connectionId,
    displayName: connection.display_name,
    phoneNumber: connection.phone_number,
    eventType: "connection_deleted",
    source: "user",
    stateInstance: connection.last_state_instance,
    statusInstance: connection.last_status_instance,
    message: `WhatsApp connection "${connection.display_name?.trim() || "Unnamed"}" was removed.`,
  });

  return c.json({ ok: true });
});

// ── Contacts ─────────────────────────────────────────────────────────────────

const contactSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: z.string().min(7),
  metadata: z.string().optional(),
});

app.get("/contacts", async (c) => {
  const workspaceId = c.get("workspaceId");
  const { page, pageSize } = parseListPageParams(
    c.req.query("page"),
    c.req.query("pageSize"),
  );
  const result = await listContactsPage(workspaceId, {
    page,
    pageSize,
    search: c.req.query("search") ?? "",
    hasMetadataOnly: c.req.query("hasMetadata") === "on",
    testOnly: c.req.query("testOnly") === "on",
  });
  return c.json({
    contacts: result.items,
    total: result.total,
    page: result.page,
    pageSize: result.pageSize,
  });
});

app.get("/contacts/options", async (c) => {
  const workspaceId = c.get("workspaceId");
  const search = c.req.query("search") ?? "";
  const limitRaw = c.req.query("limit");
  const limit = limitRaw ? Number.parseInt(limitRaw, 10) : undefined;
  const contacts = await listContactOptions(workspaceId, { search, limit });
  return c.json({ contacts });
});

app.post("/contacts", async (c) => {
  const workspaceId = c.get("workspaceId");
  const parsed = contactSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "Invalid_contact_payload" }, 400);
  await createContact({
    workspace_id: workspaceId,
    first_name: parsed.data.firstName,
    last_name: parsed.data.lastName,
    phone: parsed.data.phone,
    metadata: { note: parsed.data.metadata ?? "" },
  });
  return c.json({ ok: true });
});

app.post("/contacts/import", async (c) => {
  const workspaceId = c.get("workspaceId");
  const rows = (await c.req.json()) as Array<Record<string, string>>;
  const payload = rows.map((row) => ({
    workspace_id: workspaceId,
    first_name: row.first_name ?? row.firstName ?? "",
    last_name: row.last_name ?? row.lastName ?? "",
    phone: row.phone ?? "",
    metadata: { raw: JSON.stringify(row) },
  }));
  const result = await createContactsBulk(
    payload.filter((c) => c.first_name && c.last_name && c.phone),
  );
  return c.json(result);
});

const patchContactIsTestSchema = z.object({
  isTest: z.boolean(),
});

app.patch("/contacts/:id/test", async (c) => {
  const workspaceId = c.get("workspaceId");
  const contactId = c.req.param("id");
  const parsed = patchContactIsTestSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "Invalid payload" }, 400);
  const result = await updateContactIsTest(
    workspaceId,
    contactId,
    parsed.data.isTest,
  );
  if (!result.ok) return c.json({ error: "update_failed" }, 500);
  return c.json({ ok: true, isTest: parsed.data.isTest });
});

app.delete("/contacts/:id", async (c) => {
  const workspaceId = c.get("workspaceId");
  const contactId = c.req.param("id");
  const result = await deleteContactWithConversationData(
    workspaceId,
    contactId,
  );
  if (!result.ok) {
    if (result.message === "Contact not found") {
      return c.json({ error: "not_found", message: result.message }, 404);
    }
    return c.json({ error: "delete_failed", message: result.message }, 500);
  }
  return c.json({ ok: true });
});

// ── Conversation labels ─────────────────────────────────────────────────────

const conversationLabelBody = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(2000).optional().default(""),
});

app.get("/conversation-labels", async (c) => {
  const workspaceId = c.get("workspaceId");
  const labels = await listConversationLabels(workspaceId);
  return c.json({ labels });
});

app.post("/conversation-labels", async (c) => {
  const workspaceId = c.get("workspaceId");
  const parsed = conversationLabelBody.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "Invalid payload" }, 400);
  const result = await createConversationLabel({
    workspaceId,
    name: parsed.data.name,
    description: parsed.data.description ?? "",
  });
  if (!result.ok || !result.id) return c.json({ error: "create_failed" }, 500);
  return c.json({ id: result.id });
});

app.patch("/conversation-labels/:id", async (c) => {
  const workspaceId = c.get("workspaceId");
  const labelId = c.req.param("id");
  const parsed = conversationLabelBody.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "Invalid payload" }, 400);
  const result = await updateConversationLabel({
    workspaceId,
    labelId,
    name: parsed.data.name,
    description: parsed.data.description ?? "",
  });
  if (!result.ok) return c.json({ error: "update_failed" }, 500);
  return c.json({ ok: true });
});

app.delete("/conversation-labels/:id", async (c) => {
  const workspaceId = c.get("workspaceId");
  const labelId = c.req.param("id");
  const result = await deleteConversationLabel(workspaceId, labelId);
  if (!result.ok) return c.json({ error: "delete_failed" }, 500);
  return c.json({ ok: true });
});

// ── Conversations ─────────────────────────────────────────────────────────────

const conversationMessageCursorUuidRe =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidConversationMessageCursor(
  beforeCreatedAt: string,
  beforeId: string,
): boolean {
  if (!conversationMessageCursorUuidRe.test(beforeId)) return false;
  if (beforeCreatedAt.includes('"') || beforeCreatedAt.includes("\\")) return false;
  if (Number.isNaN(Date.parse(beforeCreatedAt))) return false;
  return true;
}

app.get("/conversations", async (c) => {
  const workspaceId = c.get("workspaceId");
  const q = c.req.query("q") ?? "";
  const labelId = c.req.query("labelId")?.trim() ?? "";
  const humanOnlyRaw = c.req.query("humanOnly")?.trim().toLowerCase() ?? "";
  const humanHandlingOnly =
    humanOnlyRaw === "1" || humanOnlyRaw === "true" || humanOnlyRaw === "yes";
  const connectionIdRaw = c.req.query("connectionId")?.trim() ?? "";
  const connectionUuidRe =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const whatsappConnectionId =
    connectionIdRaw.length > 0 && connectionUuidRe.test(connectionIdRaw)
      ? connectionIdRaw
      : undefined;
  const conversations = await listConversations(workspaceId, {
    searchQuery: q || undefined,
    labelId: labelId.length > 0 ? labelId : undefined,
    humanHandlingOnly: humanHandlingOnly ? true : undefined,
    whatsappConnectionId,
  });
  return c.json({ conversations });
});

app.get("/conversations/:id/messages", async (c) => {
  const workspaceId = c.get("workspaceId");
  const conversationId = c.req.param("id");
  const beforeCreatedAt = c.req.query("beforeCreatedAt")?.trim() ?? "";
  const beforeId = c.req.query("beforeId")?.trim() ?? "";
  const limitRaw = c.req.query("limit")?.trim() ?? "";

  const existing = await getConversationWithContact(workspaceId, conversationId);
  if (!existing) return c.json({ error: "conversation_not_found" }, 404);

  if (!beforeCreatedAt || !beforeId || !isValidConversationMessageCursor(beforeCreatedAt, beforeId)) {
    return c.json({ error: "invalid_cursor" }, 400);
  }

  const limitParsed = limitRaw.length > 0 ? Number.parseInt(limitRaw, 10) : 50;
  const page = await listConversationMessagesOlderPage(
    workspaceId,
    conversationId,
    Number.isFinite(limitParsed) ? limitParsed : 50,
    beforeCreatedAt,
    beforeId,
  );
  return c.json(page);
});

app.get("/conversations/:id/agent-messages", async (c) => {
  const userId = c.get("userId");
  const workspaceId = c.get("workspaceId");
  const conversationId = c.req.param("id");

  const existing = await getConversationWithContact(workspaceId, conversationId);
  if (!existing) return c.json({ error: "conversation_not_found" }, 404);

  const owner = await isWorkspaceOwner(workspaceId, userId);
  if (!owner) return c.json({ error: "forbidden" }, 403);

  const messages = await listAgentMessages(workspaceId, conversationId);
  return c.json({ messages });
});

app.get("/conversations/:id", async (c) => {
  const workspaceId = c.get("workspaceId");
  const conversationId = c.req.param("id");
  const limitRaw = c.req.query("messagesLimit")?.trim() ?? "";
  const limitParsed = limitRaw.length > 0 ? Number.parseInt(limitRaw, 10) : 50;
  const [conversation, page] = await Promise.all([
    getConversationWithContact(workspaceId, conversationId),
    listConversationMessagesLatestPage(
      workspaceId,
      conversationId,
      Number.isFinite(limitParsed) ? limitParsed : 50,
    ),
  ]);
  if (!conversation) return c.json({ error: "conversation_not_found" }, 404);
  return c.json({
    conversation,
    messages: page.messages,
    hasMoreOlderMessages: page.hasMoreOlderMessages,
  });
});

const sendConversationMessageSchema = z.object({
  message: z.string().min(1).max(20000),
});

const sendConversationMediaSchema = z.object({
  caption: z.string().max(20000).optional(),
  mediaKind: z.enum(["file", "image", "audio"]),
});

app.post("/conversations/:id/messages", async (c) => {
  const workspaceId = c.get("workspaceId");
  const conversationId = c.req.param("id");
  const existing = await getConversationWithContact(
    workspaceId,
    conversationId,
  );
  if (!existing) return c.json({ error: "conversation_not_found" }, 404);

  const contentType = c.req.header("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    const formData = await c.req.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) return c.json({ error: "file_required" }, 400);
    const parsed = sendConversationMediaSchema.safeParse({
      caption: formData.get("caption") || undefined,
      mediaKind: formData.get("mediaKind"),
    });
    if (!parsed.success) return c.json({ error: "Invalid payload" }, 400);
    const result = await sendManualConversationMedia({
      workspaceId,
      conversationId,
      fileName: file.name || "attachment",
      mimeType: file.type || "application/octet-stream",
      data: await file.arrayBuffer(),
      caption: parsed.data.caption,
      mediaKind: parsed.data.mediaKind,
    });
    if (!result.ok) return c.json({ error: result.error }, 422);
    return c.json(result);
  }

  const parsed = sendConversationMessageSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "Invalid payload" }, 400);
  const result = await sendManualConversationMessage({
    workspaceId,
    conversationId,
    message: parsed.data.message,
  });
  if (!result.ok) return c.json({ error: result.error }, 422);
  return c.json(result);
});

const patchConversationHandlingModeSchema = z.object({
  handlingMode: z.enum(["ai", "human"]),
});

app.patch("/conversations/:id/handling-mode", async (c) => {
  const workspaceId = c.get("workspaceId");
  const conversationId = c.req.param("id");
  const parsed = patchConversationHandlingModeSchema.safeParse(
    await c.req.json(),
  );
  if (!parsed.success) return c.json({ error: "Invalid payload" }, 400);
  const existing = await getConversationWithContact(
    workspaceId,
    conversationId,
  );
  if (!existing) return c.json({ error: "conversation_not_found" }, 404);
  const updated = await updateConversationHandlingMode(
    workspaceId,
    conversationId,
    parsed.data.handlingMode,
  );
  if (!updated.ok) return c.json({ error: "update_failed" }, 500);
  if (
    existing.handlingMode !== "human" &&
    parsed.data.handlingMode === "human"
  ) {
    const eventSaved = await createConversationMessage(
      workspaceId,
      conversationId,
      "assistant",
      "Manual Handoff",
      { thread_event: THREAD_EVENT_MANUAL_TOGGLE },
      null,
    );
    if (!eventSaved.ok) {
      console.error(
        `[UserRoutes/patchConversationHandlingMode] Failed query: unable to save manual toggle event conversationId=${conversationId}`,
      );
    }
  }
  return c.json({ ok: true, handlingMode: parsed.data.handlingMode });
});

async function handleDeleteConversation(c: {
  get: (key: "workspaceId") => string;
  req: { param: (key: "id") => string };
  json: (body: unknown, status?: number) => Response;
}) {
  const workspaceId = c.get("workspaceId");
  const conversationId = c.req.param("id");
  const result = await deleteConversation(workspaceId, conversationId);
  if (!result.ok) return c.json({ error: "delete_failed" }, 500);
  if (!result.deleted) return c.json({ error: "conversation_not_found" }, 404);
  return c.json({ ok: true });
}

app.delete("/conversations/:id", (c) => handleDeleteConversation(c));
app.post("/conversations/:id/delete", (c) => handleDeleteConversation(c));

const putConversationUserLabelsSchema = z.object({
  labelIds: z.array(z.string().uuid()),
});

app.put("/conversations/:id/labels/user", async (c) => {
  const workspaceId = c.get("workspaceId");
  const conversationId = c.req.param("id");
  const parsed = putConversationUserLabelsSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "Invalid payload" }, 400);
  const existing = await getConversationWithContact(
    workspaceId,
    conversationId,
  );
  if (!existing) return c.json({ error: "conversation_not_found" }, 404);
  const valid = await validateLabelIdsForWorkspace(
    workspaceId,
    parsed.data.labelIds,
  );
  if (!valid) return c.json({ error: "invalid_labels" }, 400);
  const updated = await replaceAssignmentsForConversation({
    workspaceId,
    conversationId,
    labelIds: parsed.data.labelIds,
    source: "user",
  });
  if (!updated.ok) return c.json({ error: "update_failed" }, 500);
  return c.json({ ok: true });
});

// ── Tasks ─────────────────────────────────────────────────────────────────────

const createTaskSchema = taskScheduleSchema
  .extend({
    prompt: z.string().min(1),
    agentId: z.string().min(1),
    whatsappConnectionId: z.string().uuid().optional(),
    fileUrl: z.string().url().optional(),
    taskLinkMode: z.enum(["single_contact", "contactless", "tools_source"]),
    contactId: z.string().optional(),
    dailyContactLimit: z.number().int().min(1).max(100).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.taskLinkMode === "single_contact") {
      if (!data.contactId?.trim())
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Contact is required for single-contact tasks.",
          path: ["contactId"],
        });
      if (data.dailyContactLimit != null)
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Daily limit applies only to CRM batch tasks.",
          path: ["dailyContactLimit"],
        });
    }
  });

app.get("/tasks", async (c) => {
  const workspaceId = c.get("workspaceId");
  const { page, pageSize } = parseListPageParams(
    c.req.query("page"),
    c.req.query("pageSize"),
  );
  const [tasksResult, agents] = await Promise.all([
    listTasksPage(workspaceId, {
      page,
      pageSize,
      search: c.req.query("search") ?? "",
    }),
    listSchedulableAgents(workspaceId),
  ]);
  return c.json({
    tasks: tasksResult.items,
    agents,
    total: tasksResult.total,
    page: tasksResult.page,
    pageSize: tasksResult.pageSize,
  });
});

app.post("/tasks", async (c) => {
  const workspaceId = c.get("workspaceId");
  const body = await c.req.json();
  const parsed = createTaskSchema.safeParse(body);
  if (!parsed.success)
    return c.json(
      { error: "invalid_task_payload", issues: parsed.error.flatten() },
      400,
    );

  const availableAgents = await listSchedulableAgents(workspaceId);
  if (!availableAgents.some((a) => a.id === parsed.data.agentId))
    return c.json({ error: "agent_not_eligible" }, 422);

  const bound = await bindAgentToFirstAvailableAuthorizedConnection(
    workspaceId,
    parsed.data.agentId,
  );
  if (!bound.ok) return c.json({ error: "agent_not_eligible" }, 422);

  const connectionResolved = await resolveWhatsappConnectionIdForAgentTask(
    workspaceId,
    parsed.data.agentId,
    parsed.data.whatsappConnectionId,
  );
  if (!connectionResolved.ok) {
    return c.json(
      {
        error:
          connectionResolved.error.includes("multiple")
            ? "whatsapp_connection_required"
            : "whatsapp_connection_invalid",
        message: connectionResolved.error,
      },
      422,
    );
  }

  let cronExpression: string | null = null;
  let oneTimeAt: string | null = null;
  let timezone = "UTC";
  try {
    const schedule = toCronSchedule(parsed.data);
    cronExpression = schedule.cronExpression;
    oneTimeAt = schedule.oneTimeAt;
    timezone = schedule.timezone;
  } catch {
    return c.json({ error: "invalid_schedule" }, 422);
  }

  let leadId: string | null = null;
  const dailyContactLimit =
    parsed.data.taskLinkMode === "contactless"
      ? (parsed.data.dailyContactLimit ?? null)
      : null;
  if (
    parsed.data.taskLinkMode === "single_contact" &&
    parsed.data.contactId?.trim()
  ) {
    const leadRecord = await findOrCreateLeadForContact(
      workspaceId,
      parsed.data.contactId.trim(),
    );
    if (!leadRecord) return c.json({ error: "lead_resolve_failed" }, 422);
    leadId = leadRecord.id;
  }

  const taskId = crypto.randomUUID();
  let jobPayload: Record<string, unknown> = {};
  try {
    const scheduled = await scheduleAgentTask({
      workspaceId,
      agentConfigId: parsed.data.agentId,
      prompt: parsed.data.prompt,
      fileUrl: parsed.data.fileUrl ?? null,
      cronExpression,
      oneTimeAt,
      taskId,
      conversationId: null,
      leadId: leadId ?? undefined,
      scheduledAt: oneTimeAt ?? null,
    });
    jobPayload = scheduled.payload;
  } catch {
    return c.json({ error: "task_schedule_failed" }, 422);
  }

  const result = await createTask({
    id: taskId,
    workspaceId,
    agentConfigId: parsed.data.agentId,
    whatsappConnectionId: connectionResolved.connectionId,
    leadId,
    prompt: parsed.data.prompt,
    scheduleType: parsed.data.scheduleType,
    cronExpression,
    oneTimeAt,
    fileUrl: parsed.data.fileUrl ?? null,
    timezone,
    dailyContactLimit,
    jobPayload,
    source: "user",
  });
  if (!result.ok) return c.json({ error: result.message }, 500);
  return c.json({ id: taskId });
});

app.post("/tasks/:id/cancel", async (c) => {
  const workspaceId = c.get("workspaceId");
  const taskId = c.req.param("id");
  const task = await getTaskById(workspaceId, taskId);
  if (!task) {
    return c.json({ error: "task_not_found" }, 404);
  }
  if (task.status === "cancelled") {
    return c.json({ ok: true });
  }

  await cancelScheduledTask(task.job_payload);
  const cancelled = await cancelTaskById(workspaceId, taskId);
  if (!cancelled) {
    return c.json({ error: "task_cancel_failed" }, 500);
  }

  return c.json({ ok: true });
});

const emailSchema = z.object({
  email: z.string().email(),
});

// ── Team ──────────────────────────────────────────────────────────────────────

app.get("/team", async (c) => {
  const workspaceId = c.get("workspaceId");
  const members = await listMembers(workspaceId);
  return c.json({ members });
});

app.post("/team", async (c) => {
  const workspaceId = c.get("workspaceId");
  const userId = c.get("userId");
  const owner = await isWorkspaceOwner(workspaceId, userId);
  if (!owner) return c.json({ error: "forbidden" }, 403);

  const parsed = emailSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "invalid_payload" }, 400);

  const result = await addMember(workspaceId, parsed.data.email);
  if (!result.ok) {
    const status =
      result.message === "user_not_found"
        ? 404
        : result.message === "user_disabled"
          ? 403
          : 409;
    return c.json({ error: result.message }, status);
  }
  return c.json({ ok: true });
});

// ── Profile ───────────────────────────────────────────────────────────────────

app.get("/profile", async (c) => {
  const userId = c.get("userId");
  const workspaceId = c.get("workspaceId");
  const user = await findUserById(userId);
  const profileRow = await getProfileForSettings(userId);
  const [workspace] = await Promise.all([
    getWorkspaceRow(workspaceId),
  ]);
  const isOwner = workspace
    ? workspace.ownerUserId.trim().toLowerCase() === userId.trim().toLowerCase()
    : false;

  const dbFirst = profileRow?.first_name?.trim() ?? "";
  const dbLast = profileRow?.last_name?.trim() ?? "";
  const firstName = dbFirst || "";
  const lastName = dbLast || "";
  const email = user?.email ?? "";

  return c.json({
    profile: {
      id: userId,
      email: email,
      firstName: dbFirst || firstName,
      lastName: dbLast || lastName,
    },
    workspace: workspace
      ? {
          id: workspace.id,
          name: workspace.name,
          createdAt: workspace.createdAt,
          role: isOwner ? ("owner" as const) : ("member" as const),
        }
      : null,
    storage: await getWorkspaceStorageUsage(workspaceId),
  });
});

const profileUpdateSchema = z.object({
  firstName: z.string(),
  lastName: z.string(),
});

app.put("/profile", async (c) => {
  const userId = c.get("userId");
  const parsed = profileUpdateSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "invalid_payload" }, 400);
  await updateProfile(userId, {
    first_name: parsed.data.firstName.trim(),
    last_name: parsed.data.lastName.trim(),
  });
  return c.json({ ok: true });
});

const workspaceUpdateSchema = z.object({
  name: z.string().trim().min(1).max(120),
});

app.put("/workspace", async (c) => {
  const userId = c.get("userId");
  const workspaceId = c.get("workspaceId");
  const parsed = workspaceUpdateSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "invalid_payload" }, 400);

  const result = await updateWorkspaceNameAsOwner(
    workspaceId,
    userId,
    parsed.data.name,
  );

  if (!result.ok) {
    const status = result.message === "forbidden" ? 403 : 400;
    return c.json(
      { error: result.message ?? "workspace_update_failed" },
      status,
    );
  }

  return c.json({ ok: true });
});

app.post("/profile/password", async (c) => {
  const userId = c.get("userId");
  const { currentPassword, newPassword } = (await c.req.json()) as { currentPassword?: string; newPassword: string };
  if (!newPassword || newPassword.length < 8)
    return c.json({ error: "invalid_password" }, 400);
  if (!currentPassword)
    return c.json({ error: "current_password_required" }, 400);

  const user = await findUserById(userId);
  if (!user || !user.passwordHash) return c.json({ error: "user_not_found" }, 404);

  const valid = await verifyPassword(user.passwordHash, currentPassword);
  if (!valid) return c.json({ error: "invalid_current_password" }, 401);

  const newHash = await hashPassword(newPassword);
  await updateUserPassword(userId, newHash);
  return c.json({ ok: true });
});

// ── Auth callback (profile ensure) ───────────────────────────────────────────

app.post("/auth/ensure-profile", async (c) => {
  const userId = c.get("userId");
  const user = await findUserById(userId);
  if (user) {
    await provisionPlatformUser(user.id, "");
  }
  return c.json({ ok: true });
});

export default app;
