import { useCallback, useEffect, useState } from "react";
import { useWorkspace } from "@/context/workspace";
import { api } from "@/lib/api";
import type { UserProfileSettingsApiResponse } from "@/types/repositories";

export function useProfileSettings(): {
  bundle: UserProfileSettingsApiResponse | null;
  loading: boolean;
  loadError: string | null;
  reload: () => Promise<void>;
  savePersonal: (firstName: string, lastName: string) => Promise<void>;
  saveWorkspaceName: (name: string) => Promise<void>;
} {
  const { workspaceId } = useWorkspace();
  const [bundle, setBundle] = useState<UserProfileSettingsApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const reload = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent === true;
    if (!silent) {
      setLoading(true);
      setLoadError(null);
    }
    try {
      const data = await api.get<UserProfileSettingsApiResponse>("/api/user/profile", { workspaceId });
      setBundle(data);
      if (!silent) setLoadError(null);
    } catch {
      if (!silent) {
        setLoadError("profile_load_failed");
        setBundle(null);
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const savePersonal = useCallback(
    async (firstName: string, lastName: string) => {
      await api.put("/api/user/profile", { firstName, lastName }, { workspaceId });
      await reload({ silent: true });
    },
    [reload, workspaceId],
  );

  const saveWorkspaceName = useCallback(
    async (name: string) => {
      await api.put("/api/user/workspace", { name }, { workspaceId });
      await reload({ silent: true });
    },
    [reload, workspaceId],
  );

  return { bundle, loading, loadError, reload, savePersonal, saveWorkspaceName };
}
