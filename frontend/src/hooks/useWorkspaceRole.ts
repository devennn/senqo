import { useCallback, useEffect, useState } from "react";
import { useWorkspace } from "@/context/workspace";
import { api } from "@/lib/api";
import type { UserProfileSettingsApiResponse, UserProfileSettingsWorkspace } from "@/types/repositories";

export type WorkspaceRole = UserProfileSettingsWorkspace["role"];

export function useWorkspaceRole(): {
  role: WorkspaceRole | null;
  loading: boolean;
} {
  const { workspaceId } = useWorkspace();
  const [role, setRole] = useState<WorkspaceRole | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<UserProfileSettingsApiResponse>("/api/user/profile", {
        workspaceId,
      });
      setRole(data.workspace?.role ?? null);
    } catch {
      setRole(null);
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { role, loading };
}
