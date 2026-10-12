import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";

export type DriveAccessMode = "entire_drive" | "folder" | "file";

export type WorkspaceAppStatus = {
  toolkit: string;
  displayName: string;
  status: "active" | "disconnected" | "not_connected";
  connectedAt: string | null;
  accessMode?: DriveAccessMode;
  scopeId?: string | null;
  scopeName?: string | null;
  accessLabel?: string;
};

export type LinkedDocListItem = {
  id: string;
  workspace_id: string;
  source: "upload" | "google_drive";
  file_name: string;
  mime_type: string;
  description: string;
  drive_file_id: string | null;
  storage_path: string | null;
  file_size_bytes: number;
  open_url?: string | null;
  created_at: string;
  updated_at: string;
};

export type DriveFileListItem = {
  id: string;
  name: string;
  mimeType: string;
};

type DriveListOpts = {
  q?: string;
  purpose?: "browse" | "scope";
  kind?: "file" | "folder" | "any";
};

const driveListCache = new Map<string, DriveFileListItem[]>();
const driveListInflight = new Map<string, Promise<DriveFileListItem[]>>();

function driveListCacheKey(opts?: DriveListOpts): string {
  return [
    opts?.purpose ?? "",
    opts?.kind ?? "",
    opts?.q?.trim() ?? "",
  ].join("|");
}

export function getCachedDriveItems(
  opts?: DriveListOpts,
): DriveFileListItem[] | undefined {
  return driveListCache.get(driveListCacheKey(opts));
}

function clearDriveListCache(): void {
  driveListCache.clear();
  driveListInflight.clear();
}

async function fetchDriveItems(
  opts?: DriveListOpts,
): Promise<DriveFileListItem[]> {
  const key = driveListCacheKey(opts);
  const cached = driveListCache.get(key);
  if (cached) return cached;
  const inflight = driveListInflight.get(key);
  if (inflight) return inflight;

  const promise = (async () => {
    const params = new URLSearchParams();
    if (opts?.q?.trim()) params.set("q", opts.q.trim());
    if (opts?.purpose) params.set("purpose", opts.purpose);
    if (opts?.kind) params.set("kind", opts.kind);
    const qs = params.toString() ? `?${params.toString()}` : "";
    const res = await api.get<{ files: DriveFileListItem[] }>(
      `/api/user/apps/googledrive/files${qs}`,
    );
    const files = Array.isArray(res.files) ? res.files : [];
    driveListCache.set(key, files);
    return files;
  })().finally(() => {
    driveListInflight.delete(key);
  });

  driveListInflight.set(key, promise);
  return promise;
}

export function useWorkspaceApps() {
  const [apps, setApps] = useState<WorkspaceAppStatus[]>([]);
  const [composioConfigured, setComposioConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    setError(null);
    try {
      const res = await api.get<{
        composioConfigured: boolean;
        apps: WorkspaceAppStatus[];
      }>("/api/user/apps");
      setComposioConfigured(Boolean(res.composioConfigured));
      setApps(Array.isArray(res.apps) ? res.apps : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load apps");
      setApps([]);
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const connectGoogleDrive = useCallback(async () => {
    const res = await api.post<{ redirectUrl: string }>(
      "/api/user/apps/googledrive/connect",
      {},
    );
    if (!res.redirectUrl) {
      throw new Error("No redirect URL from Composio");
    }
    window.location.assign(res.redirectUrl);
  }, []);

  const completeGoogleDrive = useCallback(async () => {
    await api.post("/api/user/apps/googledrive/complete", {});
    clearDriveListCache();
    await reload();
  }, [reload]);

  const disconnectGoogleDrive = useCallback(async () => {
    await api.delete("/api/user/apps/googledrive");
    clearDriveListCache();
    await reload();
  }, [reload]);

  const updateDriveAccessScope = useCallback(
    async (input: {
      accessMode: DriveAccessMode;
      scopeId?: string | null;
      scopeName?: string | null;
      scopeMimeType?: string | null;
    }) => {
      await api.patch("/api/user/apps/googledrive/scope", input);
      clearDriveListCache();
      await reload({ silent: true });
    },
    [reload],
  );

  const listDriveItems = useCallback(
    async (opts?: DriveListOpts) => fetchDriveItems(opts),
    [],
  );

  return {
    apps,
    composioConfigured,
    loading,
    error,
    reload,
    connectGoogleDrive,
    completeGoogleDrive,
    disconnectGoogleDrive,
    updateDriveAccessScope,
    listDriveItems,
  };
}

export function useLinkedDocs() {
  const [docs, setDocs] = useState<LinkedDocListItem[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    try {
      const res = await api.get<{ docs: LinkedDocListItem[] }>(
        "/api/user/apps/linked-docs",
      );
      setDocs(Array.isArray(res.docs) ? res.docs : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const createUploadDoc = useCallback(
    async (file: File, description: string) => {
      const form = new FormData();
      form.set("description", description);
      form.set("file", file);
      const res = await api.postForm<{ doc: LinkedDocListItem }>(
        "/api/user/apps/linked-docs",
        form,
      );
      await reload({ silent: true });
      return res.doc;
    },
    [reload],
  );

  const createDriveDoc = useCallback(
    async (input: {
      driveFileId: string;
      fileName: string;
      mimeType: string;
      description: string;
    }) => {
      const res = await api.post<{ doc: LinkedDocListItem }>(
        "/api/user/apps/linked-docs",
        {
          source: "google_drive",
          ...input,
        },
      );
      await reload({ silent: true });
      return res.doc;
    },
    [reload],
  );

  const updateDescription = useCallback(
    async (id: string, description: string) => {
      await api.patch(`/api/user/apps/linked-docs/${id}`, { description });
      await reload({ silent: true });
    },
    [reload],
  );

  const removeDoc = useCallback(
    async (id: string) => {
      await api.delete(`/api/user/apps/linked-docs/${id}`);
      await reload({ silent: true });
    },
    [reload],
  );

  const listDriveFiles = useCallback(
    async (q: string) =>
      fetchDriveItems({ purpose: "browse", kind: "file", q }),
    [],
  );

  const summarizeUploadFile = useCallback(async (file: File) => {
    const form = new FormData();
    form.set("file", file);
    const res = await api.postForm<{ description: string }>(
      "/api/user/apps/linked-docs/summarize",
      form,
    );
    return res.description;
  }, []);

  const summarizeDriveFile = useCallback(
    async (input: {
      driveFileId: string;
      fileName: string;
      mimeType: string;
    }) => {
      const res = await api.post<{ description: string }>(
        "/api/user/apps/linked-docs/summarize",
        {
          source: "google_drive",
          ...input,
        },
      );
      return res.description;
    },
    [],
  );

  const summarizeExistingDoc = useCallback(async (id: string) => {
    const res = await api.post<{ description: string }>(
      `/api/user/apps/linked-docs/${id}/summarize`,
      {},
    );
    return res.description;
  }, []);

  return {
    docs,
    loading,
    reload,
    createUploadDoc,
    createDriveDoc,
    updateDescription,
    removeDoc,
    listDriveFiles,
    summarizeUploadFile,
    summarizeDriveFile,
    summarizeExistingDoc,
  };
}
