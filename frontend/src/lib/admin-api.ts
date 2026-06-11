import { getAccessToken } from "./auth-client";

const apiBaseUrl = ((import.meta.env as Record<string, string | undefined>).VITE_API_BASE_URL ?? "").replace(
  /\/$/,
  "",
);

function resolveUrl(path: string): string {
  if (!apiBaseUrl || /^https?:\/\//.test(path)) return path;
  return `${apiBaseUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

async function adminRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const token = (await getAccessToken()) ?? "";
  if (!token) throw new Error("Unauthorized");

  const res = await fetch(resolveUrl(path), {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init.headers ?? {}),
    },
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }

  return res.json() as Promise<T>;
}

export type AdminWorkspaceRecord = {
  id: string;
  name: string;
  owner_user_id: string;
  owner_email: string | null;
  created_at: string;
  member_count: number;
};

export type AdminUserRecord = {
  id: string;
  email: string;
  created_at: string;
  is_instance_admin: boolean;
  disabled_at: string | null;
  owned_workspace_count: number;
};

export async function fetchAdminSettings(): Promise<{ allowPublicRegistration: boolean }> {
  return adminRequest("/api/admin/settings");
}

export async function patchAdminSettings(allowPublicRegistration: boolean): Promise<void> {
  await adminRequest("/api/admin/settings", {
    method: "PATCH",
    body: JSON.stringify({ allowPublicRegistration }),
  });
}

export async function fetchAdminWorkspaces(): Promise<AdminWorkspaceRecord[]> {
  const data = await adminRequest<{ workspaces: AdminWorkspaceRecord[] }>("/api/admin/workspaces");
  return data.workspaces;
}

export async function deleteAdminWorkspace(id: string): Promise<void> {
  await adminRequest(`/api/admin/workspaces/${id}`, { method: "DELETE" });
}

export async function fetchAdminUsers(): Promise<AdminUserRecord[]> {
  const data = await adminRequest<{ users: AdminUserRecord[] }>("/api/admin/users");
  return data.users;
}

export async function disableAdminUser(id: string): Promise<void> {
  await adminRequest(`/api/admin/users/${id}/disable`, { method: "POST" });
}

export async function enableAdminUser(id: string): Promise<void> {
  await adminRequest(`/api/admin/users/${id}/enable`, { method: "POST" });
}

export async function deleteAdminUser(id: string): Promise<void> {
  await adminRequest(`/api/admin/users/${id}`, { method: "DELETE" });
}

export async function promoteAdminUser(id: string): Promise<void> {
  await adminRequest(`/api/admin/users/${id}/superadmin`, { method: "POST" });
}

export async function demoteAdminUser(id: string): Promise<void> {
  await adminRequest(`/api/admin/users/${id}/superadmin`, { method: "DELETE" });
}

export async function sendAdminRegistrationInvite(email: string): Promise<void> {
  await adminRequest("/api/admin/registration-invites", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}
