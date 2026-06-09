export type CreateScheduledTaskApiRequest = {
  message: string;
  senderPhone: string;
  phoneNumber: string;
  fileUrl?: string;
  scheduleType: "one_time";
  scheduleAt: string;
  timezone: string;
};

export type CreateScheduledTaskApiSuccess = {
  ok: true;
  id: string;
};

export type CreateScheduledTaskApiError =
  | { ok: false; error: "invalid_api_key" }
  | { ok: false; error: "api_key_expired" }
  | { ok: false; error: "forbidden_host" }
  | { ok: false; error: "invalid_payload"; issues?: unknown }
  | { ok: false; error: "unsupported_schedule_type" }
  | { ok: false; error: "sender_not_registered" }
  | { ok: false; error: "sender_not_activated" }
  | { ok: false; error: "sender_agent_not_attached" }
  | {
      ok: false;
      error: "sender_not_ready";
      setupStatus: "not_registered" | "not_activated" | "agent_not_attached";
    }
  | { ok: false; error: "contact_resolve_failed" }
  | { ok: false; error: "lead_resolve_failed" }
  | { ok: false; error: "invalid_schedule" }
  | { ok: false; error: "task_schedule_failed" }
  | { ok: false; error: "invalid_file_url" }
  | { ok: false; error: "internal_error" };

export type CreateScheduledTaskApiResponse =
  | CreateScheduledTaskApiSuccess
  | CreateScheduledTaskApiError;
