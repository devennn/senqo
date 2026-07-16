export type WorkspaceSummary = {
  id: string;
  name: string;
  role: "owner" | "member" | "superadmin";
};

export type TeamMemberRecord = {
  id: string;
  email: string | null;
  role: string;
  joined_at: string | null;
};

export type WorkspaceResponseTemplateEntryInput = {
  questionText: string;
  answerText: string;
};

export type WorkspaceResponseTemplateEntryRecord = {
  id: string;
  sort_order: number;
  question_text: string;
  answer_text: string;
};

export type WorkspaceResponseTemplateGroupSummary = {
  id: string;
  name: string;
  updated_at: string;
  entry_count: number;
};

export type WorkspaceResponseTemplateGroupWithEntries = {
  id: string;
  name: string;
  updated_at: string;
  entries: WorkspaceResponseTemplateEntryRecord[];
};

export type WorkspaceHandoffTopicEntryRecord = {
  id: string;
  sort_order: number;
  topic: string;
  description: string;
};

export type WorkspaceHandoffTopicGroupSummary = {
  id: string;
  name: string;
  updated_at: string;
  entry_count: number;
};

export type WorkspaceHandoffTopicGroupWithEntries = {
  id: string;
  name: string;
  updated_at: string;
  entries: WorkspaceHandoffTopicEntryRecord[];
};

export type WorkspaceContextEntryRecord = {
  id: string;
  sort_order: number;
  title: string;
  body_text: string;
};

export type WorkspaceContextGroupSummary = {
  id: string;
  name: string;
  updated_at: string;
  entry_count: number;
};

export type WorkspaceContextGroupWithEntries = {
  id: string;
  name: string;
  updated_at: string;
  entries: WorkspaceContextEntryRecord[];
};

export type AgentConfigRecord = {
  id: string;
  profile_name: string;
  behavior: string;
  tools: string[];
  skills: string[];
  updated_at: string;
  first_used_at: string | null;
  auto_assign_conversation_labels: boolean;
  response_template_groups: string[];
  handoff_topic_groups: string[];
  context_groups: string[];
  asset_groups: string[];
};

export type WorkspaceStorageUsage = {
  usedBytes: number;
  breakdown: {
    assetsBytes: number;
    mediaBytes: number;
  };
};

export type WorkspaceAssetGroupSummary = {
  id: string;
  name: string;
  updated_at: string;
  asset_count: number;
};

export type AgentAssetRecord = {
  id: string;
  workspace_id: string;
  group_id: string;
  file_name: string;
  storage_path: string;
  mime_type: string;
  description: string;
  file_size_bytes: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
  preview_url?: string | null;
};

export type WorkspaceAssetGroupWithAssets = {
  id: string;
  name: string;
  updated_at: string;
  assets: AgentAssetRecord[];
};

export type AgentToolDefinitionRecord = {
  id: string;
  workspace_id: string | null;
  tool_key: string;
  display_name: string;
  description: string;
  scope: "system" | "shared" | "workspace";
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type WorkspaceSecretListItem = {
  id: string;
  name: string;
  description: string;
  value_hint: string;
  created_at: string;
  updated_at: string;
};

export type WorkspaceSecretCreateResponse = {
  secretId: string;
  value: string;
};

export type WorkspaceCustomToolListItem = {
  id: string;
  workspace_id: string;
  tool_key: string;
  display_name: string;
  description: string;
  required_env: string[];
  is_active: boolean;
  source_hash: string;
  created_at: string;
  updated_at: string;
};

export type WorkspaceCustomToolDetailRecord = WorkspaceCustomToolListItem & {
  source_code: string;
  input_schema: Record<string, unknown>;
  test_input: string;
};

export type WorkspaceSkillDefinitionRecord = {
  id: string;
  workspace_id: string;
  skill_key: string;
  display_name: string;
  description: string;
  storage_path: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type AgentMessageRole = "system" | "user" | "assistant" | "tool";

export type AgentMessageRecord = {
  id: string;
  workspace_id: string;
  agent_session_id: string;
  role: AgentMessageRole;
  content: unknown;
  provider_options: Record<string, unknown> | null;
  created_at: string;
};

/** GET /api/user/conversations/:id/agent-messages — owner-only agent transcript. */
export type ConversationAgentMessagesResponse = {
  messages: AgentMessageRecord[];
};

export type InsertAgentMessageInput = {
  workspaceId: string;
  sessionId: string;
  role: AgentMessageRole;
  content: unknown;
  providerOptions?: Record<string, unknown>;
  waMessageId?: string | null;
};

export type AgentSessionRecord = {
  id: string;
  workspace_id: string;
  status: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type CreateAgentSessionInput = {
  workspaceId: string;
  sessionId: string;
  metadata?: Record<string, unknown>;
};

export type ContactInput = {
  workspace_id: string;
  first_name: string;
  last_name: string;
  phone: string;
  metadata: Record<string, string>;
};

export type ConversationHandlingMode = "ai" | "human";

export type ConversationLabelAssignmentSource = "user" | "ai";

export type ConversationLabelRecord = {
  id: string;
  workspace_id: string;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
};

export type ConversationLabelBadge = {
  id: string;
  name: string;
  source: ConversationLabelAssignmentSource;
};

export type ConversationHeaderData = {
  id: string;
  title: string;
  status: string;
  handlingMode: ConversationHandlingMode;
  connectionAiEnabled: boolean | null;
  canSendManualWhatsapp: boolean;
  isGroup: boolean;
  whatsappChatId: string | null;
  /** Thread line when the conversation is scoped to a WhatsApp connection. */
  whatsappConnection: {
    id: string;
    displayName: string;
    phoneNumber: string | null;
  } | null;
  group: {
    subject: string | null;
    owner: string | null;
    size: number | null;
  } | null;
  labels: ConversationLabelBadge[];
  contact: {
    firstName: string;
    lastName: string;
    phone: string;
    avatarUrl: string | null;
  } | null;
};

export type ContactEmbed = {
  first_name: string;
  last_name: string;
  phone: string;
  metadata: Record<string, unknown> | null;
} | null;

export type ConversationSummary = {
  id: string;
  title: string;
  status: string;
  handlingMode: ConversationHandlingMode;
  isGroup: boolean;
  whatsappChatId: string | null;
  whatsappConnection: {
    id: string;
    displayName: string;
    phoneNumber: string | null;
  } | null;
  group: ConversationHeaderData["group"];
  labels: ConversationLabelBadge[];
  updated_at: string;
  contact: ConversationHeaderData["contact"];
  lastMessage: {
    content: string;
    createdAt: string;
    /** True when the latest stored message is assistant-side (sent from the workspace / WhatsApp out). */
    isOutbound: boolean;
    /** WhatsApp group threads: short sender before preview (e.g. first name, AI, Human). */
    groupPreviewSenderLabel?: string | null;
  } | null;
};

/** Inbox row last-line preview: optional group sender prefix vs body for split typography. */
export type ConversationListPreviewParts = {
  /** e.g. `Joseph: ` including trailing space; null when no sender label. */
  prefix: string | null;
  body: string;
};

export type ConversationQuotedPreviewMediaKind = "image" | "video" | "audio" | "document";

export type ConversationQuotedPreview = {
  senderLabel: string;
  bodyText: string | null;
  thumbnailDataUrl: string | null;
  mediaKind: ConversationQuotedPreviewMediaKind | null;
  /** Set when the quoted original is loaded in the current thread page. */
  targetMessageId: string | null;
};

export type ConversationMessageMedia = {
  path?: string;
  /** Object storage namespace; defaults to whatsapp-media when signing previews. */
  storageBucket?: string;
  fileName?: string;
  mimeType?: string;
  caption?: string;
  sourceUrl?: string;
  thumbnailDataUrl?: string;
  signedUrl?: string;
  fileSizeBytes?: number;
};

export type ConversationMessage = {
  id: string;
  role: string;
  content: string;
  created_at: string;
  metadata: Record<string, unknown> | null;
  outgoing_sender_type: "ai_agent" | "human" | null;
  whatsapp_sender_chat_id: string | null;
  whatsapp_sender_name: string | null;
  media: ConversationMessageMedia | null;
  /** Dashboard-only: optimistic manual send until the server row appears or send fails. */
  clientSendState?: "sending" | "failed";
};

/** Default page size for dashboard thread message API (must match backend cap semantics). */
export const CONVERSATION_THREAD_MESSAGES_PAGE_SIZE = 50;

export type ConversationThreadMessagesPage = {
  messages: ConversationMessage[];
  hasMoreOlderMessages: boolean;
};

export type ConversationThreadDetailResponse = ConversationThreadMessagesPage & {
  conversation: ConversationHeaderData;
};

export type ConversationRow = {
  id: string;
  title: string;
  status: string;
  updated_at: string;
  contact_id: string | null;
  is_group: boolean;
  whatsapp_chat_id: string | null;
  whatsapp_group_subject: string | null;
  whatsapp_group_owner: string | null;
  whatsapp_group_size: number | null;
  contacts: ContactEmbed | ContactEmbed[];
};

export type WhatsappConnectionMode = "inactive" | "testing" | "live";

export type WhatsappConnection = {
  id: string;
  workspace_id?: string;
  agent_config_id?: string | null;
  mode: WhatsappConnectionMode;
  display_name: string;
  status: string;
  phone_number: string | null;
  qr_code_payload: string | null;
  webhook_token: string | null;
  wa_avatar_url: string | null;
  wa_device_id: string | null;
  last_state_instance: string | null;
  last_status_instance: string | null;
  last_seen_at: string | null;
  last_sync_at: string | null;
};

export type WhatsappConnectionEventType =
  | "connection_created"
  | "connection_authorized"
  | "connection_disconnected"
  | "connection_deleted";

export type WhatsappConnectionEventSource = "user" | "webhook" | "status_refresh";

export type WhatsappConnectionEvent = {
  id: string;
  workspace_id: string;
  connection_id_snapshot: string | null;
  display_name: string | null;
  phone_number: string | null;
  event_type: WhatsappConnectionEventType;
  source: WhatsappConnectionEventSource;
  state_instance: string | null;
  status_instance: string | null;
  message: string;
  created_at: string;
};

export type SendConversationMessageResponse = {
  ok: true;
  idMessage: string;
  urlFile?: string;
};

export type ConversationAttachmentKind = "file" | "image" | "audio";

export type ConversationAttachmentInput = {
  file: File;
  kind: ConversationAttachmentKind;
  caption?: string;
};

export type CreateConnectionInput = {
  workspaceId: string;
  displayName: string;
  webhookToken: string;
  qrCodePayload?: string | null;
};

export type TaskRecord = {
  id: string;
  workspace_id: string;
  agent_config_id: string;
  lead_id: string | null;
  prompt: string;
  file_url: string | null;
  schedule_type: "recurring" | "one_time";
  cron_expression: string | null;
  one_time_at: string | null;
  timezone: string;
  /** When set with no lead, each run messages up to this many `new` leads via WhatsApp. */
  daily_contact_limit: number | null;
  status: "active" | "cancelled";
  job_payload: Record<string, unknown>;
  source: "user" | "ai" | "api";
  created_at: string;
  updated_at: string;
};

export type TaskRunRecord = {
  id: string;
  workspace_id: string;
  task_id: string;
  status: "success" | "fail";
  started_at: string | null;
  finished_at: string | null;
  error_message: string | null;
  created_at: string;
};

export type RecordTaskRunInput = {
  workspaceId: string;
  taskId: string;
  status: "success" | "fail";
  errorMessage?: string | null;
};

export type CreateTaskInput = {
  id: string;
  workspaceId: string;
  agentConfigId: string;
  whatsappConnectionId?: string | null;
  leadId?: string | null;
  prompt: string;
  scheduleType: "recurring" | "one_time";
  cronExpression?: string | null;
  oneTimeAt?: string | null;
  fileUrl?: string | null;
  timezone?: string;
  dailyContactLimit?: number | null;
  jobPayload: Record<string, unknown>;
  source?: "user" | "ai" | "api";
};

export type PaginatedResult<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
};

export type SchedulableAgentRecord = {
  id: string;
  profile_name: string;
  connections: Array<{
    id: string;
    display_name: string;
    phone_number: string | null;
  }>;
};

/** Minimal contact row for task creation UI (optional lead link). */
export type TaskFormContactOption = {
  id: string;
  label: string;
};

export type TaskListItem = {
  id: string;
  prompt: string;
  file_url: string | null;
  schedule_type: "recurring" | "one_time";
  cron_expression: string | null;
  one_time_at: string | null;
  timezone: string;
  source: "user" | "ai" | "api";
  created_at: string;
  lead_id: string | null;
  lead_contact: {
    firstName: string;
    lastName: string;
    phone: string;
  } | null;
  daily_contact_limit: number | null;
  status: "active" | "cancelled";
  agent: {
    id: string;
    profile_name: string;
  };
  recent_runs?: Array<{
    status: "success" | "fail";
    created_at: string;
  }>;
  last_run_status: "success" | "fail" | null;
};

export type LeadStatus = "new" | "contacted" | "qualified" | "lost" | "won";

export type LeadRecord = {
  id: string;
  workspace_id: string;
  contact_id: string;
  status: LeadStatus;
  source: "manual" | "import" | "ai";
  created_at: string;
  updated_at: string;
};

/** Contact row resolved from a lead for outbound WhatsApp task execution. */
export type LeadContactRow = {
  contactId: string;
  firstName: string;
  lastName: string;
  phone: string;
};

export type UserProfileSettingsWorkspace = {
  id: string;
  name: string;
  createdAt: string;
  role: "owner" | "member";
};

/** GET /api/user/profile — account, workspace summary for settings UI. */
export type UserProfileSettingsApiResponse = {
  profile: {
    id: string;
    email: string | null;
    firstName: string;
    lastName: string;
  };
  workspace: UserProfileSettingsWorkspace | null;
  storage: WorkspaceStorageUsage | null;
};

export type ApiKeyListItem = {
  id: string;
  label: string;
  keyPrefix: string;
  expiresAt: string | null;
  createdAt: string;
};

export type ApiKeyListResponse = {
  apiKeys: ApiKeyListItem[];
};

export type ApiKeyCreateResponse = {
  apiKey: string;
  keyPrefix: string;
  label: string;
  expiresAt: string | null;
};
