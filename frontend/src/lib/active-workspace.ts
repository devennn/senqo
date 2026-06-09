let activeWorkspaceId = "";

export function setActiveWorkspaceId(id: string): void {
  activeWorkspaceId = id;
}

export function getActiveWorkspaceId(): string {
  return activeWorkspaceId;
}
