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
};

const EMPTY_SUMMARY: AgentPerformanceSummary = {
  conversationsHandled: 0,
  aiReplies: 0,
  handoffs: 0,
  inHumanMode: 0,
};

function buildReportsQueryString(range: ReportsDateRange): string {
  const params = new URLSearchParams();
  params.set("from", range.from);
  params.set("to", range.to);
  return params.toString();
}

export function useAgentReports(range: ReportsDateRange) {
  const [agents, setAgents] = useState<AgentPerformanceRow[]>([]);
  const [topics, setTopics] = useState<HandoffTopicPerformanceRow[]>([]);
  const [summary, setSummary] = useState<AgentPerformanceSummary>(EMPTY_SUMMARY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReport = useCallback(async (nextRange: ReportsDateRange) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<AgentReportsResponse>(
        `/api/user/reports/agents?${buildReportsQueryString(nextRange)}`,
      );
      setAgents(Array.isArray(res.agents) ? res.agents : []);
      setTopics(Array.isArray(res.topics) ? res.topics : []);
      setSummary(res.summary ?? EMPTY_SUMMARY);
    } catch {
      setAgents([]);
      setTopics([]);
      setSummary(EMPTY_SUMMARY);
      setError("Could not load reports.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchReport(range);
  }, [fetchReport, range.from, range.to]);

  return {
    agents,
    topics,
    summary,
    loading,
    error,
    refetch: () => fetchReport(range),
  };
}
