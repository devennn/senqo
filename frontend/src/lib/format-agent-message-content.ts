export type FormattedAgentMessageContent =
  | { kind: "text"; text: string }
  | { kind: "json"; json: string };

export function prettifyJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function tryParseJsonString(value: string): unknown | null {
  const trimmed = value.trim();
  if (
    trimmed.length === 0 ||
    (!trimmed.startsWith("{") && !trimmed.startsWith("[") && !trimmed.startsWith('"'))
  ) {
    return null;
  }

  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return null;
  }
}

export function formatAgentMessageContent(content: unknown): FormattedAgentMessageContent {
  if (typeof content === "string") {
    const parsed = tryParseJsonString(content);
    if (parsed !== null) {
      return { kind: "json", json: prettifyJson(parsed) };
    }
    return { kind: "text", text: content };
  }

  if (typeof content === "object" && content !== null) {
    return { kind: "json", json: prettifyJson(content) };
  }

  return { kind: "text", text: String(content) };
}

export function formatAgentMessageProviderOptions(
  providerOptions: Record<string, unknown> | null,
): string | null {
  if (!providerOptions || Object.keys(providerOptions).length === 0) {
    return null;
  }

  return prettifyJson(providerOptions);
}
