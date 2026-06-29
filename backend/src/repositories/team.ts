import { listWorkspaceMembers, addWorkspaceMember } from "./workspaces.js";
import type { TeamMemberRecord } from "../types/repositories.js";

export async function listMembers(workspaceId: string): Promise<TeamMemberRecord[]> {
  return listWorkspaceMembers(workspaceId);
}

export async function addMember(
  workspaceId: string,
  email: string,
): Promise<{ ok: boolean; message: string }> {
  return addWorkspaceMember(workspaceId, email);
}
