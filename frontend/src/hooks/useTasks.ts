import { useState, useCallback, useEffect } from "react";
import { useWorkspace } from "@/context/workspace";
import { api } from "@/lib/api";
import { TASKS_UI_PAGE_SIZE } from "@/lib/tasks-limits";
import type { TaskListItem, SchedulableAgentRecord } from "@/types/repositories";

export type TasksQuery = {
  page: number;
  search: string;
};

type TasksPageResponse = {
  tasks: TaskListItem[];
  agents: SchedulableAgentRecord[];
  total: number;
  page: number;
  pageSize: number;
};

function buildTasksQueryString(query: TasksQuery): string {
  const params = new URLSearchParams();
  params.set("page", String(query.page));
  params.set("pageSize", String(TASKS_UI_PAGE_SIZE));
  if (query.search.trim()) params.set("search", query.search.trim());
  return params.toString();
}

const TASKS_POLL_INTERVAL_MS = 5000;

type FetchPageOptions = {
  silent?: boolean;
};

export function useTasks(query: TasksQuery) {
  const { workspaceId } = useWorkspace();
  const [tasks, setTasks] = useState<TaskListItem[]>([]);
  const [agents, setAgents] = useState<SchedulableAgentRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchPage = useCallback(async (nextQuery: TasksQuery, options?: FetchPageOptions) => {
    if (!workspaceId) return;
    const silent = options?.silent === true;
    if (!silent) {
      setLoading(true);
    }
    try {
      const res = await api.get<TasksPageResponse>(
        `/api/user/tasks?${buildTasksQueryString(nextQuery)}`,
        { workspaceId },
      );
      setTasks(res.tasks);
      setAgents(res.agents);
      setTotal(res.total);
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, [workspaceId]);

  useEffect(() => {
    void fetchPage(query);
  }, [fetchPage, query.page, query.search]);

  useEffect(() => {
    if (!workspaceId) return;
    const interval = setInterval(() => {
      void fetchPage({ page: query.page, search: query.search }, { silent: true });
    }, TASKS_POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [workspaceId, fetchPage, query.page, query.search]);

  const createTask = useCallback(async (formData: FormData) => {
    await api.post("/api/user/tasks", {
      prompt: String(formData.get("prompt") ?? ""),
      agentId: String(formData.get("agentId") ?? ""),
      fileUrl: String(formData.get("fileUrl") ?? "") || undefined,
      taskLinkMode: String(formData.get("taskLinkMode") ?? "contactless"),
      contactId: String(formData.get("contactId") ?? "") || undefined,
      dailyContactLimit: formData.get("dailyContactLimit") ? Number(formData.get("dailyContactLimit")) : undefined,
      scheduleType: String(formData.get("scheduleType") ?? "recurring"),
      schedulePreset: String(formData.get("schedulePreset") ?? "") || undefined,
      intervalMinutes: String(formData.get("intervalMinutes") ?? "") || undefined,
      dailyTime: String(formData.get("dailyTime") ?? "") || undefined,
      weeklyDay: String(formData.get("weeklyDay") ?? "") || undefined,
      weeklyTime: String(formData.get("weeklyTime") ?? "") || undefined,
      monthlyDate: String(formData.get("monthlyDate") ?? "") || undefined,
      monthlyTime: String(formData.get("monthlyTime") ?? "") || undefined,
      oneTimeAt: String(formData.get("oneTimeAt") ?? "") || undefined,
    });
  }, []);

  const cancelTask = useCallback(async (taskId: string) => {
    await api.post(`/api/user/tasks/${taskId}/cancel`);
    setTasks((current) =>
      current.map((task) =>
        task.id === taskId ? { ...task, status: "cancelled" } : task,
      ),
    );
  }, []);

  return {
    tasks,
    agents,
    total,
    loading,
    pageSize: TASKS_UI_PAGE_SIZE,
    createTask,
    cancelTask,
    refetch: (options?: FetchPageOptions) => fetchPage(query, options),
  };
}
