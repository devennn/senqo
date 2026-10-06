import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useParams } from "react-router-dom";
import { api } from "@/lib/api";
import { setActiveWorkspaceId } from "@/lib/active-workspace";
import type { WorkspaceSummary } from "@/types/repositories";

interface WorkspaceContextValue {
  workspaceId: string;
  workspaceName: string | null;
  loadingWorkspaceName: boolean;
  wsPath: (path: string) => string;
  refreshWorkspaceName: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const { workspaceId = "" } = useParams<{ workspaceId: string }>();
  const workspaceIdRef = useRef(workspaceId);
  const [workspaceName, setWorkspaceName] = useState<string | null>(null);
  const [loadingWorkspaceName, setLoadingWorkspaceName] = useState(false);

  useLayoutEffect(() => {
    workspaceIdRef.current = workspaceId;
    setActiveWorkspaceId(workspaceId);
    return () => setActiveWorkspaceId("");
  }, [workspaceId]);

  const refreshWorkspaceName = useCallback(async () => {
    const requestedId = workspaceId;
    if (!requestedId) {
      setWorkspaceName(null);
      setLoadingWorkspaceName(false);
      return;
    }

    setLoadingWorkspaceName(true);
    try {
      const data = await api.get<{ workspaces: WorkspaceSummary[] }>(
        "/api/user/workspaces",
      );
      if (workspaceIdRef.current !== requestedId) return;
      const match = data.workspaces?.find((workspace) => workspace.id === requestedId);
      setWorkspaceName(match?.name?.trim() || null);
    } catch {
      if (workspaceIdRef.current === requestedId) setWorkspaceName(null);
    } finally {
      if (workspaceIdRef.current === requestedId) setLoadingWorkspaceName(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    void refreshWorkspaceName();
  }, [refreshWorkspaceName]);

  const wsPath = useCallback(
    (path: string) => `/${workspaceId}${path.startsWith("/") ? path : `/${path}`}`,
    [workspaceId],
  );

  const value = useMemo(
    () => ({
      workspaceId,
      workspaceName,
      loadingWorkspaceName,
      wsPath,
      refreshWorkspaceName,
    }),
    [workspaceId, workspaceName, loadingWorkspaceName, wsPath, refreshWorkspaceName],
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used inside WorkspaceProvider");
  return ctx;
}
