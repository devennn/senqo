import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type {
  ApiKeyCreateResponse,
  ApiKeyListItem,
  ApiKeyListResponse,
} from "@/types/repositories";

type CreateInput = {
  label: string;
  expiresAt: string | null;
};

export function useApiKeys(): {
  items: ApiKeyListItem[];
  loading: boolean;
  loadError: string | null;
  creating: boolean;
  revokingId: string | null;
  createResult: ApiKeyCreateResponse | null;
  reload: (options?: { silent?: boolean }) => Promise<void>;
  createKey: (input: CreateInput) => Promise<void>;
  deleteKey: (apiKeyId: string) => Promise<void>;
  clearCreateResult: () => void;
} {
  const [items, setItems] = useState<ApiKeyListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [createResult, setCreateResult] = useState<ApiKeyCreateResponse | null>(
    null,
  );

  const reload = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent === true;
    if (!silent) {
      setLoading(true);
      setLoadError(null);
    }
    try {
      const data = await api.get<ApiKeyListResponse>("/api/user/api-keys");
      setItems(data.apiKeys);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "api_keys_load_failed";
      if (!silent) {
        setLoadError(message);
        setItems([]);
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const createKey = useCallback(
    async (input: CreateInput) => {
      setCreating(true);
      try {
        const created = await api.post<ApiKeyCreateResponse>("/api/user/api-keys", {
          label: input.label,
          expiresAt: input.expiresAt,
        });
        setCreateResult(created);
        await reload({ silent: true });
      } finally {
        setCreating(false);
      }
    },
    [reload],
  );

  const deleteKey = useCallback(
    async (apiKeyId: string) => {
      setRevokingId(apiKeyId);
      try {
        await api.delete<{ ok: true }>(`/api/user/api-keys/${apiKeyId}`);
        await reload({ silent: true });
      } finally {
        setRevokingId(null);
      }
    },
    [reload],
  );

  return {
    items,
    loading,
    loadError,
    creating,
    revokingId,
    createResult,
    reload,
    createKey,
    deleteKey,
    clearCreateResult: () => setCreateResult(null),
  };
}
