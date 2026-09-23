import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { ConversationReportRow, ReportsDateRange } from "@/types/reports";

type ConversationReportsResponse = {
  reports: ConversationReportRow[];
  total: number;
};

type Params = {
  range: ReportsDateRange;
  agentId?: string;
  page: number;
  pageSize: number;
};

function buildQueryString(params: Params): string {
  const query = new URLSearchParams();
  query.set("from", params.range.from);
  query.set("to", params.range.to);
  if (params.agentId) query.set("agentId", params.agentId);
  query.set("limit", String(params.pageSize));
  query.set("offset", String((params.page - 1) * params.pageSize));
  return query.toString();
}

/** Reported-conversations listing for the Reports tab (paged, workspace-scoped). */
export function useConversationReports({
  range,
  agentId,
  page,
  pageSize,
}: Params) {
  const [reports, setReports] = useState<ConversationReportRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReports = useCallback(async (next: Params) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<ConversationReportsResponse>(
        `/api/user/reports/conversation-reports?${buildQueryString(next)}`,
      );
      setReports(Array.isArray(res.reports) ? res.reports : []);
      setTotal(Number(res.total) || 0);
    } catch {
      setReports([]);
      setTotal(0);
      setError("Could not load reported conversations.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchReports({ range, agentId, page, pageSize });
  }, [fetchReports, range.from, range.to, agentId, page, pageSize]);

  return {
    reports,
    total,
    loading,
    error,
    refetch: () => fetchReports({ range, agentId, page, pageSize }),
  };
}