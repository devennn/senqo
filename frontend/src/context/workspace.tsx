import { createContext, useContext, useEffect } from "react";
import { useParams } from "react-router-dom";
import { setActiveWorkspaceId } from "@/lib/active-workspace";

interface WorkspaceContextValue {
  workspaceId: string;
  wsPath: (path: string) => string;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const { workspaceId = "" } = useParams<{ workspaceId: string }>();

  // Set before child effects run — useEffect here would run after child fetches.
  setActiveWorkspaceId(workspaceId);

  useEffect(() => {
    return () => setActiveWorkspaceId("");
  }, []);

  const wsPath = (path: string) => `/${workspaceId}${path.startsWith("/") ? path : `/${path}`}`;

  return (
    <WorkspaceContext.Provider value={{ workspaceId, wsPath }}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used inside WorkspaceProvider");
  return ctx;
}
