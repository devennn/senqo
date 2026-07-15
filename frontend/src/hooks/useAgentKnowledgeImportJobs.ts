import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { AgentKnowledgeImportJob } from "@/types/agent-knowledge-import-job";
import {
  AGENT_KNOWLEDGE_IMPORT_POLL_MS,
  pickActiveAgentKnowledgeImportJob,
} from "@/types/agent-knowledge-import-job";

export function useAgentKnowledgeImportJobs(agentId: string | null) {
  const [jobs, setJobs] = useState<AgentKnowledgeImportJob[]>([]);

  const refresh = useCallback(async (): Promise<AgentKnowledgeImportJob[]> => {
    if (!agentId) {
      setJobs([]);
      return [];
    }
    try {
      const result = await api.get<{ jobs: AgentKnowledgeImportJob[] }>(
        `/api/user/agents/${agentId}/knowledge-import/jobs`,
      );
      setJobs(result.jobs);
      return result.jobs;
    } catch {
      setJobs([]);
      return [];
    }
  }, [agentId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const hasActive = jobs.some(
      (job) => job.status === "queued" || job.status === "processing" || job.status === "ready",
    );
    if (!hasActive) return;

    const timer = window.setInterval(() => {
      void refresh();
    }, AGENT_KNOWLEDGE_IMPORT_POLL_MS);

    return () => window.clearInterval(timer);
  }, [jobs, refresh]);

  const activeJob =
    pickActiveAgentKnowledgeImportJob(jobs) ??
    jobs.find((job) => job.status === "failed") ??
    null;

  return { jobs, activeJob, refresh };
}
