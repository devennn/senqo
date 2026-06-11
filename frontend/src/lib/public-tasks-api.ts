export type CreateTaskApiExampleInput = {
  apiKey?: string;
  message?: string;
  senderPhone?: string;
  phoneNumber?: string;
  scheduleAt?: string;
  timezone?: string;
  fileUrl?: string;
};

function normalizeConfiguredApiHost(raw: string): string {
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed) {
    return "";
  }

  try {
    if (trimmed.includes("://")) {
      return new URL(trimmed).hostname;
    }
  } catch {
    // Fall through to hostname-only parsing.
  }

  const withoutPort = trimmed.split(":")[0]?.trim() ?? "";
  if (!withoutPort) {
    return "";
  }
  return withoutPort.endsWith(".") ? withoutPort.slice(0, -1) : withoutPort;
}

function configuredPublicApiHost(): string | null {
  const raw = (import.meta.env as Record<string, string | undefined>).VITE_API_URL?.trim();
  if (!raw) {
    return null;
  }
  const host = normalizeConfiguredApiHost(raw);
  return host || null;
}

function publicApiProtocolForHost(host: string): "http:" | "https:" {
  if (host === "localhost" || host.endsWith(".localhost")) {
    return "http:";
  }
  return "https:";
}

export function getPublicTasksApiUrl(): string {
  const configuredHost = configuredPublicApiHost();
  if (configuredHost) {
    const protocol = publicApiProtocolForHost(configuredHost);
    return `${protocol}//${configuredHost}/api/tasks`;
  }

  if (typeof window === "undefined") {
    return "https://localhost/api/tasks";
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
