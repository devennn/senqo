export function normalizePublicApiHostname(input: string): string {
  const trimmed = input.trim().toLowerCase();
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

function parseHostnameList(raw: string): string[] {
  const hosts: string[] = [];
  for (const part of raw.split(",")) {
    const host = normalizePublicApiHostname(part);
    if (host) {
      hosts.push(host);
    }
  }
  return hosts;
}

/** Hostnames allowed for POST /api/tasks in production. API_URL wins; else FRONTEND_URL hostname. */
export function resolvePublicApiAllowedHosts(
  apiUrl: string | undefined,
  frontendUrl: string | undefined,
): string[] {
  const fromApiUrl = parseHostnameList(apiUrl ?? "");
  if (fromApiUrl.length > 0) {
    return fromApiUrl;
  }

  const fromFrontend = normalizePublicApiHostname(frontendUrl ?? "");
  return fromFrontend ? [fromFrontend] : [];
}
