/** Display label for the active workspace: its name, or the workspace id while loading/failed. */
export function workspaceDisplayName(name: string | null, workspaceId: string): string {
  const trimmed = name?.trim();
  return trimmed || workspaceId || "Workspace";
}

/** Single-character avatar fallback for the active workspace. */
export function workspaceInitial(name: string | null, workspaceId: string): string {
  return workspaceDisplayName(name, workspaceId).charAt(0).toUpperCase();
}
