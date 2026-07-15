import type { StoredUserImageUrlPart } from "./agent-multimodal.js";
import type { AgentOutboundMessage } from "../agent/agent-output-schema.js";

export type RunAgentInput = {
  workspaceId: string;
  message: string;
  messageTimestamp?: string;
  sessionId?: string;
  agentConfigId?: string;
  dryRun?: boolean;
  /** When true, persist inbound user message only; do not run the model or tools. */
  skipInference?: boolean;
  /** Optional reason used for operator logs when inference is intentionally skipped. */
  skipInferenceReason?: string;
  /**
   * Optional image parts (OpenAI-style `image_url`), appended after `message` text in order:
   * text first, then each image. Persisted to `agent_messages` as stored; normalized for the model at inference.
   */
  userMediaParts?: StoredUserImageUrlPart[];
};

export type RunAgentResult = {
  sessionId: string;
  messages: AgentOutboundMessage[];
  handoff_enabled: boolean;
};

export type SkillSummary = {
  id: string;
  skillKey: string;
  name: string;
  description: string;
};

export type LoadSkillResult =
  | { ok: true; content: string }
  | { ok: false; error: string };

export type AgentToolRuntimeContext = {
  workspaceId: string;
  sessionId: string;
  agentConfigId?: string;
  /** Present for non-dry agent runs; used to correlate WhatsApp rows with operator reasoning. */
  agentRunId?: string;
};

export type AgentStepFinishToolCallLog = {
  toolName: string;
  toolCallId: string;
  args: unknown;
};

export type AgentStepFinishToolResultLog = {
  toolName: string;
  toolCallId: string;
  output: unknown;
};

export type AgentToolKey =
  | "load_skills"
  | "create_task"
  | "handoff_to_human"
  | "apply_conversation_labels";

export type AgentAssetInstructionGroup = {
  name: string;
  assets: { fileName: string; description: string }[];
};

export type AgentSystemPromptInput = {
  dryRun: boolean;
  enabledToolKeys: string[];
  customToolDescriptions: Record<string, string>;
  workspaceContext: string;
  responseTemplates: string;
  handoffTopics: string;
  conversationLabels: string;
  assetGroups: AgentAssetInstructionGroup[];
  profileName: string;
  behavior: string;
};

export type GeocodingResult = {
  results?: Array<{
    name: string;
    country?: string;
    admin1?: string;
    latitude: number;
    longitude: number;
    timezone?: string;
  }>;
};

export type ForecastResult = {
  current?: {
    temperature_2m?: number;
    relative_humidity_2m?: number;
    weather_code?: number;
    wind_speed_10m?: number;
    time?: string;
  };
  current_units?: {
    temperature_2m?: string;
    wind_speed_10m?: string;
  };
};
