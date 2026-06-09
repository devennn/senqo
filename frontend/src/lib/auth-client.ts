type AuthTokens = {
  accessToken: string | null;
  refreshToken: string | null;
};

const TOKENS_KEY = "senqo_auth";
const ACCESS_TOKEN_LEEWAY_SEC = 30;

let refreshInFlight: Promise<string | null> | null = null;

function getApiBase(): string {
  const raw = (import.meta.env as Record<string, string | undefined>).VITE_API_BASE_URL ?? "";
  return raw.replace(/\/$/, "");
}

function getTokens(): AuthTokens {
  try {
    const raw = localStorage.getItem(TOKENS_KEY);
    if (!raw) return { accessToken: null, refreshToken: null };
    const parsed = JSON.parse(raw) as { accessToken?: string | null; refreshToken?: string | null };
    return {
      accessToken: parsed.accessToken ?? null,
      refreshToken: parsed.refreshToken ?? null,
    };
  } catch {
    return { accessToken: null, refreshToken: null };
  }
}

function setTokens(tokens: AuthTokens): void {
  localStorage.setItem(TOKENS_KEY, JSON.stringify(tokens));
}

function clearTokens(): void {
  localStorage.removeItem(TOKENS_KEY);
}

function getJwtExpSeconds(token: string): number | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const json = JSON.parse(atob(normalized)) as { exp?: unknown };
    return typeof json.exp === "number" ? json.exp : null;
  } catch {
    return null;
  }
}

function isAccessTokenExpired(token: string, leewaySec = ACCESS_TOKEN_LEEWAY_SEC): boolean {
  const exp = getJwtExpSeconds(token);
  if (exp === null) return true;
  return Date.now() / 1000 >= exp - leewaySec;
}

type AuthTokenPayload = {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
};

/** Cookie first; also sends stored refresh token in body when present. */
export async function refreshAccessToken(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    const { refreshToken: storedRefresh } = getTokens();
    try {
      const res = await fetch(`${getApiBase()}/api/auth/refresh`, {
        method: "POST",
        credentials: "include",
        headers: storedRefresh ? { "Content-Type": "application/json" } : undefined,
        body: storedRefresh ? JSON.stringify({ refreshToken: storedRefresh }) : undefined,
      });
      if (!res.ok) {
        clearTokens();
        return null;
      }
      const data = (await res.json()) as AuthTokenPayload;
      setTokens({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken ?? storedRefresh,
      });
      return data.accessToken;
    } catch {
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

export async function getAccessToken(): Promise<string | null> {
  const { accessToken } = getTokens();
  if (accessToken && !isAccessTokenExpired(accessToken)) {
    return accessToken;
  }
  return refreshAccessToken();
}

export function saveAuthTokens(accessToken: string, refreshToken?: string | null): void {
  const existing = getTokens();
  setTokens({
    accessToken,
    refreshToken: refreshToken ?? existing.refreshToken,
  });
}

export function removeAuthTokens(): void {
  clearTokens();
}

export type AuthUser = {
  id: string;
  email: string;
};

export async function login(email: string, password: string): Promise<AuthTokenPayload> {
  const res = await fetch(`${getApiBase()}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
    credentials: "include",
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? "Login failed");
  }
  return res.json() as Promise<AuthTokenPayload>;
}

export async function register(
  email: string,
  password: string,
  fullName: string,
): Promise<AuthTokenPayload> {
  const res = await fetch(`${getApiBase()}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, fullName }),
    credentials: "include",
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? "Registration failed");
  }
  return res.json() as Promise<AuthTokenPayload>;
}

export async function logout(): Promise<void> {
  const { refreshToken } = getTokens();
  await fetch(`${getApiBase()}/api/auth/logout`, {
    method: "POST",
    credentials: "include",
    headers: refreshToken ? { "Content-Type": "application/json" } : undefined,
    body: refreshToken ? JSON.stringify({ refreshToken }) : undefined,
  }).catch(() => {});
  removeAuthTokens();
}

async function fetchSession(accessToken: string): Promise<Response> {
  return fetch(`${getApiBase()}/api/auth/session`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    credentials: "include",
  });
}

export async function getSession(): Promise<AuthUser | null> {
  let token = await getAccessToken();
  if (!token) return null;

  try {
    let res = await fetchSession(token);
    if (res.status === 401) {
      token = await refreshAccessToken();
      if (!token) {
        clearTokens();
        return null;
      }
      res = await fetchSession(token);
    }
    if (!res.ok) {
      clearTokens();
      return null;
    }
    const data = (await res.json()) as { user: AuthUser };
    return data.user;
  } catch {
    return null;
  }
}
