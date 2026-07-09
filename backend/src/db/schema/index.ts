import { sql } from "drizzle-orm";
import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  integer,
  jsonb,
  unique,
  index,
  uniqueIndex,
  primaryKey,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash"),
  emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
  isInstanceAdmin: boolean("is_instance_admin").notNull().default(false),
  disabledAt: timestamp("disabled_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const instanceSettings = pgTable("instance_settings", {
  id: text("id").primaryKey(),
  allowPublicRegistration: boolean("allow_public_registration")
    .notNull()
    .default(true),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const registrationInvites = pgTable(
  "registration_invites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    inviteToken: text("invite_token").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("registration_invites_email_idx").on(t.email)],
);

export const workspaces = pgTable("workspaces", {
  id: uuid("id").primaryKey(),
  name: text("name").notNull().default("Default Workspace"),
  ownerUserId: uuid("owner_user_id")
    .notNull()
    .references(() => users.id),
  storageAssetBytes: integer("storage_asset_bytes").notNull().default(0),
  storageMediaBytes: integer("storage_media_bytes").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const profiles = pgTable("profiles", {
  id: uuid("id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  workspaceId: uuid("workspace_id").references(() => workspaces.id, {
    onDelete: "set null",
  }),
  firstName: text("first_name"),
  lastName: text("last_name"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const workspaceMembers = pgTable("workspace_members", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull(),
  inviteEmail: text("invite_email"),
  role: text("role").notNull().default("member"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const contacts = pgTable(
  "contacts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    phone: text("phone").notNull(),
    metadata: jsonb("metadata").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    isTest: boolean("is_test").default(false),
  },
  (t) => [unique().on(t.workspaceId, t.phone)],
);

export const conversations = pgTable(
  "conversations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    contactId: uuid("contact_id").references(() => contacts.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull(),
    status: text("status").notNull().default("open"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    whatsappChatId: text("whatsapp_chat_id"),
    handlingMode: text("handling_mode").notNull().default("ai"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    whatsappConnectionId: uuid("whatsapp_connection_id"),
  },
  (t) => [
    unique("uq_conversations_workspace_whatsapp_chat_id").on(
      t.workspaceId,
      t.whatsappChatId,
    ),
    index("idx_conversations_workspace_updated").on(
      t.workspaceId,
      t.updatedAt.desc(),
    ),
    index("idx_conversations_workspace_unarchived_updated").on(
      t.workspaceId,
      t.updatedAt.desc(),
    ),
  ],
);

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    metadata: jsonb("metadata").notNull().default({}),
    outgoingSenderType: text("outgoing_sender_type"),
    whatsappSenderChatId: text("whatsapp_sender_chat_id"),
    whatsappSenderName: text("whatsapp_sender_name"),
    waMessageId: text("wa_message_id"),
  },
  (t) => [
    index("idx_messages_conversation_created").on(
      t.conversationId,
      t.createdAt.asc(),
    ),
    uniqueIndex("idx_messages_workspace_wa_message_id_unique")
      .on(t.workspaceId, t.waMessageId)
      .where(sql`${t.waMessageId} is not null`),
  ],
);

export const whatsappConnections = pgTable(
  "whatsapp_connections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    displayName: text("display_name").notNull(),
    phoneNumber: text("phone_number"),
    status: text("status").notNull().default("pending_qr"),
    qrCodePayload: text("qr_code_payload"),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    webhookToken: text("webhook_token"),
    lastStateInstance: text("last_state_instance"),
    lastStatusInstance: text("last_status_instance"),
    lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
    waAvatarUrl: text("wa_avatar_url"),
    waDeviceId: text("wa_device_id"),
    agentConfigId: uuid("agent_config_id"),
    mode: text("mode").notNull().default("inactive"),
  },
  (t) => [index("idx_whatsapp_connections_workspace").on(t.workspaceId)],
);

export const agentConfigs = pgTable(
  "agent_configs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    profileName: text("profile_name").notNull().default("Sales Assistant"),
    behavior: text("behavior").notNull().default(""),
    tools: jsonb("tools").notNull().default([]),
    skills: jsonb("skills").notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    firstUsedAt: timestamp("first_used_at", { withTimezone: true }),
    autoAssignConversationLabels: boolean("auto_assign_conversation_labels")
      .notNull()
      .default(true),
    responseTemplateGroups: jsonb("response_template_groups").default([]),
    handoffTopicGroups: jsonb("handoff_topic_groups").default([]),
    contextGroups: jsonb("context_groups").default([]),
    assetGroups: jsonb("asset_groups").default([]),
  },
  (t) => [
    index("idx_agent_configs_workspace_active").on(
      t.workspaceId,
      t.updatedAt.desc(),
    ),
  ],
);

export const whatsappWebhookEvents = pgTable(
  "whatsapp_webhook_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    whatsappConnectionId: uuid("whatsapp_connection_id").references(
      () => whatsappConnections.id,
      { onDelete: "set null" },
    ),
    dedupeKey: text("dedupe_key").notNull(),
    webhookType: text("webhook_type").notNull(),
    payload: jsonb("payload").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique().on(t.workspaceId, t.dedupeKey),
    index("idx_whatsapp_webhook_events_workspace_created").on(
      t.workspaceId,
      t.createdAt.desc(),
    ),
  ],
);

export const agentSessions = pgTable(
  "agent_sessions",
  {
    id: uuid("id").primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("active"),
    metadata: jsonb("metadata").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("idx_agent_sessions_workspace_created").on(
      t.workspaceId,
      t.createdAt.desc(),
    ),
  ],
);

export const agentMessages = pgTable(
  "agent_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    agentSessionId: uuid("agent_session_id")
      .notNull()
      .references(() => agentSessions.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    content: jsonb("content").notNull(),
    providerOptions: jsonb("provider_options"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    waMessageId: text("wa_message_id"),
  },
  (t) => [
    index("idx_agent_messages_session_created").on(
      t.agentSessionId,
      t.createdAt.asc(),
    ),
    index("idx_agent_messages_workspace_created").on(
      t.workspaceId,
      t.createdAt.desc(),
    ),
    uniqueIndex("idx_agent_messages_workspace_wa_message_id_unique")
      .on(t.workspaceId, t.waMessageId)
      .where(sql`${t.waMessageId} is not null`),
  ],
);

export const agentToolDefinitions = pgTable("agent_tool_definitions", {
  id: uuid("id").primaryKey().defaultRandom(),
  toolKey: text("tool_key").notNull().unique(),
  displayName: text("display_name").notNull(),
  description: text("description").notNull().default(""),
  isActive: boolean("is_active").notNull().default(true),
  scope: text("scope").notNull().default("shared"),
  workspaceId: uuid("workspace_id").references(() => workspaces.id, {
    onDelete: "cascade",
  }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const workspaceSecrets = pgTable(
  "workspace_secrets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    ciphertext: text("ciphertext").notNull(),
    iv: text("iv").notNull(),
    tag: text("tag").notNull(),
    valueHint: text("value_hint").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique().on(t.workspaceId, t.name),
    index("idx_workspace_secrets_workspace_updated").on(
      t.workspaceId,
      t.updatedAt.desc(),
    ),
  ],
);

export const workspaceCustomTools = pgTable(
  "workspace_custom_tools",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    toolKey: text("tool_key").notNull(),
    displayName: text("display_name").notNull(),
    description: text("description").notNull().default(""),
    sourceCode: text("source_code").notNull(),
    requiredEnv: jsonb("required_env").notNull().default([]),
    inputSchema: jsonb("input_schema").notNull().default({}),
    sourceHash: text("source_hash").notNull(),
    testInput: text("test_input").notNull().default(""),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique().on(t.workspaceId, t.toolKey),
    index("idx_workspace_custom_tools_workspace_updated").on(
      t.workspaceId,
      t.updatedAt.desc(),
    ),
  ],
);

export const workspaceSkillDefinitions = pgTable(
  "workspace_skill_definitions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    skillKey: text("skill_key").notNull(),
    displayName: text("display_name").notNull(),
    description: text("description").notNull().default(""),
    storagePath: text("storage_path").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique().on(t.workspaceId, t.skillKey),
    unique().on(t.workspaceId, t.storagePath),
    index("idx_workspace_skill_definitions_workspace_updated").on(
      t.workspaceId,
      t.updatedAt.desc(),
    ),
  ],
);

export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    agentConfigId: uuid("agent_config_id")
      .notNull()
      .references(() => agentConfigs.id, { onDelete: "restrict" }),
    prompt: text("prompt").notNull(),
    scheduleType: text("schedule_type").notNull(),
    cronExpression: text("cron_expression"),
    oneTimeAt: timestamp("one_time_at", { withTimezone: true }),
    source: text("source").notNull().default("user"),
    timezone: text("timezone").notNull().default("UTC"),
    jobPayload: jsonb("job_payload").notNull().default({}),
    dailyContactLimit: integer("daily_contact_limit"),
    fileUrl: text("file_url"),
    leadId: uuid("lead_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    status: text("status"),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  },
  (t) => [
    index("idx_tasks_workspace_created").on(t.workspaceId, t.createdAt.desc()),
    index("idx_tasks_workspace_agent").on(t.workspaceId, t.agentConfigId),
    index("idx_tasks_workspace_lead").on(t.workspaceId, t.leadId),
  ],
);

export const taskRuns = pgTable(
  "task_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    status: text("status").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("idx_task_runs_task_created").on(t.taskId, t.createdAt.desc()),
    index("idx_task_runs_workspace_created").on(
      t.workspaceId,
      t.createdAt.desc(),
    ),
  ],
);

export const leads = pgTable(
  "leads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    contactId: uuid("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("new"),
    source: text("source").notNull().default("manual"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique().on(t.workspaceId, t.contactId),
    index("idx_leads_workspace_created").on(t.workspaceId, t.createdAt.desc()),
  ],
);

export const conversationLabels = pgTable(
  "conversation_labels",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [unique().on(t.workspaceId, t.name)],
);

export const conversationLabelAssignments = pgTable(
  "conversation_label_assignments",
  {
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    labelId: uuid("label_id")
      .notNull()
      .references(() => conversationLabels.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    source: text("source").notNull(),
    assignedAt: timestamp("assigned_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.conversationId, t.labelId] }),
    index("idx_conversation_label_assignments_workspace_label").on(
      t.workspaceId,
      t.labelId,
    ),
    index("idx_conversation_label_assignments_conversation").on(
      t.conversationId,
    ),
  ],
);

export const workspaceApiKeys = pgTable("workspace_api_keys", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  keyHash: text("key_hash").notNull(),
  keyPrefix: text("key_prefix").notNull(),
  createdByUserId: uuid("created_by_user_id"),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const workspaceAssetGroups = pgTable("workspace_asset_groups", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const agentAssets = pgTable("agent_assets", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  groupId: uuid("group_id")
    .notNull()
    .references(() => workspaceAssetGroups.id, { onDelete: "cascade" }),
  fileName: text("file_name").notNull(),
  storagePath: text("storage_path").notNull(),
  mimeType: text("mime_type").notNull(),
  description: text("description").notNull().default(""),
  fileSizeBytes: integer("file_size_bytes").notNull().default(0),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const workspaceResponseTemplateGroups = pgTable(
  "workspace_response_template_groups",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
);

export const workspaceResponseTemplateEntries = pgTable(
  "workspace_response_template_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => workspaceResponseTemplateGroups.id, {
        onDelete: "cascade",
      }),
    title: text("title").notNull(),
    body: text("body").notNull().default(""),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
);

export const workspaceHandoffTopicGroups = pgTable(
  "workspace_handoff_topic_groups",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
);

export const workspaceHandoffTopicEntries = pgTable(
  "workspace_handoff_topic_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => workspaceHandoffTopicGroups.id, {
        onDelete: "cascade",
      }),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
);

export const workspaceContextGroups = pgTable("workspace_context_groups", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const workspaceContextEntries = pgTable("workspace_context_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  groupId: uuid("group_id")
    .notNull()
    .references(() => workspaceContextGroups.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  body: text("body").notNull().default(""),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const agentKnowledgeImportJobs = pgTable(
  "agent_knowledge_import_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    agentId: uuid("agent_id")
      .notNull()
      .references(() => agentConfigs.id, { onDelete: "cascade" }),
    profileName: text("profile_name").notNull(),
    status: text("status").notNull(),
    targets: jsonb("targets").notNull(),
    focusHint: text("focus_hint").notNull().default(""),
    files: jsonb("files").notNull(),
    draft: jsonb("draft"),
    selection: jsonb("selection"),
    workspaceRefs: jsonb("workspace_refs")
      .notNull()
      .default({ contextGroups: {}, templateGroups: {} }),
    errorMessage: text("error_message"),
    queueJobId: text("queue_job_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    agentStatusIdx: index("agent_knowledge_import_jobs_agent_status_idx").on(
      table.workspaceId,
      table.agentId,
      table.status,
    ),
  }),
);

export const inboundAiDebouncePending = pgTable("inbound_ai_debounce_pending", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  conversationId: uuid("conversation_id")
    .notNull()
    .references(() => conversations.id, { onDelete: "cascade" }),
  whatsappConnectionId: uuid("whatsapp_connection_id"),
  jobId: text("job_id"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
});

export const whatsappConnectionEvents = pgTable("whatsapp_connection_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  connectionIdSnapshot: uuid("connection_id_snapshot"),
  displayName: text("display_name"),
  phoneNumber: text("phone_number"),
  eventType: text("event_type").notNull(),
  source: text("source").notNull(),
  stateInstance: text("state_instance"),
  statusInstance: text("status_instance"),
  message: text("message").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const zzzWaDumps = pgTable("zzz_wa_dumps", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  whatsappConnectionId: uuid("whatsapp_connection_id"),
  instanceId: text("instance_id").notNull(),
  webhookType: text("webhook_type").notNull(),
  payload: jsonb("payload").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
