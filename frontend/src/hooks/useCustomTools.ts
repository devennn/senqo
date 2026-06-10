import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import type {
  WorkspaceCustomToolDetailRecord,
  WorkspaceCustomToolListItem,
} from "@/types/repositories";

export type ToolWithSource = WorkspaceCustomToolDetailRecord;

export type ToolsNavConfig = {
  path: string;
  fixedSearchParams: Record<string, string>;
};

function buildToolsPath(
  config: ToolsNavConfig,
  target: { toolId?: string | null; mode?: string | null },
): string {
  const p = new URLSearchParams(config.fixedSearchParams);
  if (target.toolId) p.set("toolId", target.toolId);
  else p.delete("toolId");
  if (target.mode) p.set("mode", target.mode);
  else p.delete("mode");
  const q = p.toString();
  return q ? `${config.path}?${q}` : config.path;
}

export function useCustomTools(navConfig: ToolsNavConfig) {
  const navigate = useNavigate();
  const [tools, setTools] = useState<WorkspaceCustomToolListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const fixedKey = JSON.stringify(navConfig.fixedSearchParams);

  const toToolsUrl = useCallback(
    (target: { toolId?: string | null; mode?: string | null }) =>
      buildToolsPath(
        { path: navConfig.path, fixedSearchParams: JSON.parse(fixedKey) as Record<string, string> },
        target,
      ),
    [navConfig.path, fixedKey],
  );

  const reload = useCallback(async () => {
    const res = await api.get<{ tools: WorkspaceCustomToolListItem[] }>("/api/user/custom-tools");
    setTools(res.tools);
    setLoading(false);
    return res.tools;
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const fetchTool = useCallback(async (id: string): Promise<ToolWithSource | null> => {
    try {
      const res = await api.get<{ tool: WorkspaceCustomToolDetailRecord }>(`/api/user/custom-tools/${id}`);
      return res.tool;
    } catch {
      return null;
    }
  }, []);

  const createTool = useCallback(
    async (
      displayName: string,
      description: string,
      sourceCode: string,
      requiredEnv: string[],
    ) => {
      const res = await api.post<{ toolId: string }>("/api/user/custom-tools", {
        displayName,
        description,
        sourceCode,
        requiredEnv,
      });
      await reload();
      navigate(toToolsUrl({ toolId: res.toolId }));
    },
    [reload, navigate, toToolsUrl],
  );

  const updateTool = useCallback(
    async (
      id: string,
      displayName: string,
      description: string,
      sourceCode: string,
      requiredEnv: string[],
      testInput: string,
      isActive: boolean,
    ) => {
      await api.put(`/api/user/custom-tools/${id}`, {
        displayName,
        description,
        sourceCode,
        requiredEnv,
        testInput,
        isActive,
      });
      await reload();
      navigate(toToolsUrl({ toolId: id }));
    },
    [reload, navigate, toToolsUrl],
  );

  const deleteTool = useCallback(
    async (id: string) => {
      await api.delete(`/api/user/custom-tools/${id}`);
      const next = await reload();
      navigate(toToolsUrl(next[0] ? { toolId: next[0].id } : {}));
    },
    [reload, navigate, toToolsUrl],
  );

  const testTool = useCallback(
    async (
      id: string,
      input: unknown,
      draft?: { sourceCode?: string; requiredEnv?: string[] },
    ) => {
      const res = await api.post<{ result: Record<string, unknown> }>(
        `/api/user/custom-tools/${id}/test`,
        { input, ...draft },
      );
      return res.result;
    },
    [],
  );

  return {
    tools,
    loading,
    reload,
    fetchTool,
    createTool,
    updateTool,
    deleteTool,
    testTool,
    toToolsUrl,
  };
}
