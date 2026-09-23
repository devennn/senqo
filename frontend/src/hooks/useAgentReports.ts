import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type {
  AgentPerformanceRow,
  AgentPerformanceSummary,
  HandoffTopicPerformanceRow,
  ReportsDateRange,
} from "@/types/reports";

type AgentReportsResponse = {
  agents: AgentPerformanceRow[];
  topics: HandoffTopicPerformanceRow[];
  summary: AgentPerformanceSummary;
  agentOptions: { id: string; name: string }[];
};

const EMPTY_SUMMARY: AgentPerformanceSummary = {
  totalConversations: 0,
  conversationsHandled: 0,
  totalMessages: 0,
  aiReplies: 0,
  handoffs: 0,
  inHumanMode: 0,
  technicalErrors: 0,
  reportedErrors: 0,
};

function buildReportsQueryString(
  range: ReportsDateRange,
  agentId: string | undefined,
): string {
  const params = new URLSearchParams();
  params.set("from", range.from);
  params.set("to", range.to);
  if (agentId) params.set("agentId", agentId);
  return params.toString();
}

export function useAgentReports(range: ReportsDateRange, agentId?: string) {
  const [agents, setAgents] = useState<AgentPerformanceRow[]>([]);
  const [topics, setTopics] = useState<HandoffTopicPerformanceRow[]>([]);
  const [summary, setSummary] = useState<AgentPerformanceSummary>(EMPTY_SUMMARY);
  const [agentOptions, setAgentOptions] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReport = useCallback(
    async (nextRange: ReportsDateRange, nextAgentId: string | undefined) => {
      setLoading(true);
      setError(null);
      try {
        const res = await api.get<AgentReportsResponse>(
          `/api/user/reports/agents?${buildReportsQueryString(nextRange, nextAgentId)}`,
        );
        setAgents(Array.isArray(res.agents) ? res.agents : []);
        setTopics(Array.isArray(res.topics) ? res.topics : []);
        setSummary(res.summary ?? EMPTY_SUMMARY);
        setAgentOptions(Array.isArray(res.agentOptions) ? res.agentOptions : []);
      } catch {
        setAgents([]);
        setTopics([]);
        setSummary(EMPTY_SUMMARY);
        setAgentOptions([]);
        setError("Could not load reports.");
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    void fetchReport(range, agentId);
  }, [fetchReport, range.from, range.to, agentId]);

  return {
    agents,
    topics,
    summary,
    agentOptions,
    loading,
    error,
    refetch: () => fetchReport(range, agentId),
  };
}