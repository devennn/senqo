const NON_WORKSPACE_ROOTS = new Set([
  "sign-in",
  "sign-up",
  "admin",
  "auth",
  "privacy-policy",
  "terms-of-service",
]);

let activeWorkspaceId = "";

export function setActiveWorkspaceId(id: string): void {
  activeWorkspaceId = id;
}

function workspaceIdFromPathname(): string {
  if (typeof window === "undefined") return "";
  const segment = window.location.pathname.split("/").filter(Boolean)[0] ?? "";
  if (!segment || NON_WORKSPACE_ROOTS.has(segment)) return "";
  return segment;
}

export function getActiveWorkspaceId(): string {
  return activeWorkspaceId || workspaceIdFromPathname();
}
