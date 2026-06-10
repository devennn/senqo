import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type {
  WorkspaceSecretCreateResponse,
  WorkspaceSecretListItem,
} from "@/types/repositories";

export function useWorkspaceSecrets() {
  const [items, setItems] = useState<WorkspaceSecretListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [createResult, setCreateResult] = useState<WorkspaceSecretCreateResponse | null>(null);

  const reload = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent === true;
    if (!silent) {
      setLoading(true);
      setLoadError(null);
    }
    try {
      const data = await api.get<{ secrets: WorkspaceSecretListItem[] }>("/api/user/secrets");
      setItems(data.secrets);
    } catch (error) {
      const message = error instanceof Error ? error.message : "secrets_load_failed";
      if (!silent) {
        setLoadError(message);
        setItems([]);
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const createSecret = useCallback(
    async (name: string, description: string, value: string) => {
      setCreating(true);
      try {
        const created = await api.post<WorkspaceSecretCreateResponse>("/api/user/secrets", {
          name,
          description,
          value,
        });
        setCreateResult(created);
        await reload({ silent: true });
      } finally {
        setCreating(false);
      }
    },
    [reload],
  );

  const rotateSecret = useCallback(
    async (secretId: string, value: string, description?: string) => {
      await api.put<{ ok: true; value: string }>(`/api/user/secrets/${secretId}`, {
        value,
        description,
      });
      setCreateResult({ secretId, value });
      await reload({ silent: true });
    },
    [reload],
  );

  const deleteSecret = useCallback(
    async (secretId: string) => {
      setDeletingId(secretId);
      try {
        await api.delete<{ ok: true }>(`/api/user/secrets/${secretId}`);
        await reload({ silent: true });
      } finally {
        setDeletingId(null);
      }
    },
    [reload],
  );

  return {
    items,
    loading,
    loadError,
    creating,
    deletingId,
    createResult,
    reload,
    createSecret,
    rotateSecret,
    deleteSecret,
    clearCreateResult: () => setCreateResult(null),
  };
}
