import { useCallback, useEffect, useState } from "react";
import { useWorkspace } from "@/context/workspace";
import { api } from "@/lib/api";
import type { UserProfileSettingsApiResponse } from "@/types/repositories";

export function useIsWorkspaceOwner(): {
  isOwner: boolean;
  loading: boolean;
} {
  const { workspaceId } = useWorkspace();
  const [isOwner, setIsOwner] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<UserProfileSettingsApiResponse>("/api/user/profile", {
        workspaceId,
      });
      setIsOwner(data.workspace?.role === "owner");
    } catch {
      setIsOwner(false);
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { isOwner, loading };
}
