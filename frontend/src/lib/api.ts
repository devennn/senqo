import { getAccessToken, refreshAccessToken, removeAuthTokens } from "./auth-client";
import { getActiveWorkspaceId } from "./active-workspace";

const apiBaseUrl = ((import.meta.env as Record<string, string | undefined>).VITE_API_BASE_URL ?? "").replace(
  /\/$/,
  "",
);

/** Passed to `api.*`; `workspaceId` is stripped before `fetch` (sent as `X-Workspace-Id`). */
export type ApiRequestInit = Omit<RequestInit, "headers"> & {
  workspaceId?: string;
  headers?: HeadersInit;
};

function resolveApiUrl(path: string): string {
  if (!apiBaseUrl || /^https?:\/\//.test(path)) {
    return path;
  }

  return `${apiBaseUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

function redirectToSignIn(): void {
  if (typeof window !== "undefined" && !window.location.pathname.startsWith("/sign-in")) {
    window.location.assign("/sign-in");
  }
}

async function request<T>(path: string, options: ApiRequestInit = {}, retried = false): Promise<T> {
  const { workspaceId: workspaceIdOverride, headers: userHeaders, ...rest } = options;
  let token = (await getAccessToken()) ?? "";
  if (!token) {
    token = (await refreshAccessToken()) ?? "";
  }
  if (!token) {
    removeAuthTokens();
    redirectToSignIn();
    throw new Error("Unauthorized");
  }

  const isFormData = rest.body instanceof FormData;
  const workspaceHeader = (workspaceIdOverride?.trim() || getActiveWorkspaceId()) || "";

  const res = await fetch(resolveApiUrl(path), {
    ...rest,
    credentials: "include",
    headers: {
      ...(!isFormData ? { "Content-Type": "application/json" } : {}),
      Authorization: `Bearer ${token}`,
      ...(workspaceHeader ? { "X-Workspace-Id": workspaceHeader } : {}),
      ...(userHeaders ?? {}),
    },
  });

  if (res.status === 401 && !retried) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      return request<T>(path, options, true);
    }
    removeAuthTokens();
    redirectToSignIn();
    throw new Error("Unauthorized");
  }

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as {
      error?: string;
      message?: string;
    };
    throw new Error(body.message ?? body.error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string, options?: ApiRequestInit) => request<T>(path, { method: "GET", ...options }),
  post: <T>(path: string, body?: unknown, options?: ApiRequestInit) =>
    request<T>(path, {
      method: "POST",
      body: body !== undefined ? JSON.stringify(body) : undefined,
      ...options,
    }),
  put: <T>(path: string, body?: unknown, options?: ApiRequestInit) =>
    request<T>(path, {
      method: "PUT",
      body: body !== undefined ? JSON.stringify(body) : undefined,
      ...options,
    }),
  patch: <T>(path: string, body?: unknown, options?: ApiRequestInit) =>
    request<T>(path, {
      method: "PATCH",
      body: body !== undefined ? JSON.stringify(body) : undefined,
      ...options,
    }),
  postForm: <T>(path: string, body: FormData, options?: ApiRequestInit) =>
    request<T>(path, { method: "POST", body, ...options }),
  delete: <T>(path: string, options?: ApiRequestInit) => request<T>(path, { method: "DELETE", ...options }),
};
