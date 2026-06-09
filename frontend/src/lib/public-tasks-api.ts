const PRODUCTION_APP_DOMAIN = "senqo.app";
const PRODUCTION_PUBLIC_API_HOST = "api.senqo.app";

export type CreateTaskApiExampleInput = {
  apiKey?: string;
  message?: string;
  senderPhone?: string;
  phoneNumber?: string;
  scheduleAt?: string;
  timezone?: string;
  fileUrl?: string;
};

export function getPublicTasksApiUrl(): string {
  if (typeof window === "undefined") {
    return `https://${PRODUCTION_PUBLIC_API_HOST}/api/tasks`;
  }

  const hostname = window.location.hostname.toLowerCase();
  if (
    hostname === PRODUCTION_APP_DOMAIN ||
    hostname.endsWith(`.${PRODUCTION_APP_DOMAIN}`)
  ) {
    const protocol = window.location.protocol === "http:" ? "http:" : "https:";
    return `${protocol}//${PRODUCTION_PUBLIC_API_HOST}/api/tasks`;
  }

  return `${window.location.origin}/api/tasks`;
}

function padTwo(value: number): string {
  return String(value).padStart(2, "0");
}

export function sampleScheduleAtLocal(): string {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(12, 0, 0, 0);
  return `${date.getFullYear()}-${padTwo(date.getMonth() + 1)}-${padTwo(date.getDate())}T12:00:00`;
}

export function sampleTimezone(): string {
  if (typeof Intl === "undefined") {
    return "UTC";
  }
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

export function buildCreateTaskRequestBody(
  input: CreateTaskApiExampleInput = {},
): Record<string, string> {
  const body: Record<string, string> = {
    message: input.message ?? "Hello from API",
    senderPhone: input.senderPhone ?? "+60123456789",
    phoneNumber: input.phoneNumber ?? "60198765432",
    scheduleType: "one_time",
    scheduleAt: input.scheduleAt ?? sampleScheduleAtLocal(),
    timezone: input.timezone ?? sampleTimezone(),
  };
  if (input.fileUrl) {
    body.fileUrl = input.fileUrl;
  }
  return body;
}

export function buildCreateTaskCurlExample(input: CreateTaskApiExampleInput = {}): string {
  const apiKey = input.apiKey?.trim() || "YOUR_WORKSPACE_API_KEY";
  const body = buildCreateTaskRequestBody(input);
  const payload = JSON.stringify(body, null, 2);

  return `curl --request POST \\
  --url ${getPublicTasksApiUrl()} \\
  --header 'x-api-key: ${apiKey}' \\
  --header 'content-type: application/json' \\
  --data '${payload}'`;
}
