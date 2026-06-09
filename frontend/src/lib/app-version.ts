const apiBaseUrl = ((import.meta.env as Record<string, string | undefined>).VITE_API_BASE_URL ?? "").replace(
  /\/$/,
  "",
);

function resolveHealthUrl(): string {
  const path = "/api/health";
  if (!apiBaseUrl || /^https?:\/\//.test(path)) {
    return path;
  }
  return `${apiBaseUrl}${path}`;
}

let cachedVersion: string | null = null;
let fetchPromise: Promise<string | null> | null = null;

export async function fetchAppVersion(): Promise<string | null> {
  if (cachedVersion) return cachedVersion;
  if (fetchPromise) return fetchPromise;

  fetchPromise = fetch(resolveHealthUrl())
    .then(async (res) => {
      if (!res.ok) return null;
      const data = (await res.json()) as { version?: string };
      const version = data.version?.trim();
      cachedVersion = version || null;
      return cachedVersion;
    })
    .catch(() => null)
    .finally(() => {
      fetchPromise = null;
    });

  return fetchPromise;
}
