import { useWorkspaceRole } from "@/hooks/useWorkspaceRole";

export function useIsWorkspaceOwner(): {
  isOwner: boolean;
  loading: boolean;
} {
  const { role, loading } = useWorkspaceRole();
  return { isOwner: role === "owner", loading };
}
