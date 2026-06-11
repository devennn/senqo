export const createTaskBodyParams = [
  {
    name: "message",
    type: "string",
    required: "Yes" as const,
    description: "Exact message content used as the task prompt.",
  },
  {
    name: "senderPhone",
    type: "string",
    required: "Yes" as const,
    description:
      "Sender WhatsApp number. Resolves the active connection and attached agent (with or without +).",
  },
  {
    name: "phoneNumber",
    type: "string",
    required: "Yes" as const,
    description: "Recipient phone. The backend finds or creates the contact automatically.",
  },
  {
    name: "scheduleType",
    type: '"one_time"',
    required: "Yes" as const,
    description: "Only one-time scheduling is supported for this API.",
  },
  {
    name: "scheduleAt",
    type: "local datetime string (no Z)",
    required: "Yes" as const,
    description: "Local datetime interpreted in timezone. Must be provided with timezone.",
  },
  {
    name: "timezone",
    type: "string",
    required: "Yes" as const,
    description: "IANA timezone (example: Asia/Kuala_Lumpur). Required with scheduleAt.",
  },
  {
    name: "fileUrl",
    type: "string (HTTPS URL)",
    required: "No" as const,
    description: "Optional public HTTPS file URL attached to the task payload.",
  },
] as const;

export const createTaskErrorCodes = [
  { http: "401", error: "invalid_api_key", meaning: "API key missing or invalid." },
  { http: "401", error: "api_key_expired", meaning: "API key exists but expired." },
  { http: "403", error: "forbidden_host", meaning: "Production requests must use the configured API host (API_URL or FRONTEND_URL)." },
  { http: "400", error: "invalid_payload", meaning: "Body fields are missing or invalid." },
  { http: "400", error: "invalid_file_url", meaning: "fileUrl must be a public HTTPS URL." },
  { http: "422", error: "unsupported_schedule_type", meaning: "Only one_time is supported." },
  { http: "422", error: "sender_not_registered", meaning: "Sender phone is not linked to any connection." },
  { http: "422", error: "sender_not_activated", meaning: "Sender connection is not authorized." },
  { http: "422", error: "sender_agent_not_attached", meaning: "Sender connection has no attached agent." },
  { http: "422", error: "contact_resolve_failed", meaning: "Recipient contact could not be created or resolved." },
  { http: "422", error: "lead_resolve_failed", meaning: "Lead could not be created or resolved." },
  { http: "422", error: "invalid_schedule", meaning: "Invalid scheduleAt or timezone pair." },
  { http: "422", error: "task_schedule_failed", meaning: "Queue scheduling failed." },
  { http: "500", error: "internal_error", meaning: "Unexpected server error." },
] as const;
