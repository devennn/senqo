import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import type {
  CreateFromConversationInput,
  CreateManualEvalInput,
  EvalCase,
  EvalTurn,
} from "@/types/evals";

export const EVALS_UI_PAGE_SIZE = 8;

type ListEvalsResponse = {
  cases: EvalCase[];
  total: number;
  page: number;
  pageSize: number;
};

type EvalCaseResponse = {
  evalCase: EvalCase;
};

export function useEvals(
  agentId: string | null,
  selectedId?: string | null,
): {
  cases: EvalCase[];
  total: number;
  loading: boolean;
  error: string | null;
  page: number;
  setPage: (page: number) => void;
  selectedCase: EvalCase | null;
  reload: () => Promise<void>;
  createManual: (input: CreateManualEvalInput) => Promise<EvalCase>;
  createFromConversation: (input: CreateFromConversationInput) => Promise<EvalCase>;
  updateExpected: (id: string, expectedReply: string) => Promise<EvalCase | null>;
  updateTurns: (id: string, turns: EvalTurn[]) => Promise<EvalCase | null>;
  updateDetails: (
    id: string,
    input: { title: string; expectedReply: string },
  ) => Promise<EvalCase | null>;
  remove: (id: string) => Promise<void>;
  run: (id: string) => Promise<EvalCase | null>;
  runningId: string | null;
  setHasSchedule: (id: string, hasSchedule: boolean) => void;
} {
  const [cases, setCases] = useState<EvalCase[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCase, setSelectedCase] = useState<EvalCase | null>(null);
  const [runningId, setRunningId] = useState<string | null>(null);
  const runningLockRef = useRef(false);

  const reload = useCallback(async () => {
    if (!agentId) {
      setCases([]);
      setTotal(0);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<ListEvalsResponse>(
        `/api/user/evals?agentId=${encodeURIComponent(agentId)}&page=${page}&pageSize=${EVALS_UI_PAGE_SIZE}`,
      );
      setCases(res.cases);
      setTotal(res.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load evals");
      setCases([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [agentId, page]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!selectedId) {
      setSelectedCase(null);
      return;
    }
    const fromPage = cases.find((item) => item.id === selectedId);
    if (fromPage) {
      setSelectedCase(fromPage);
      return;
    }
    let cancelled = false;
    void api
      .get<EvalCaseResponse>(`/api/user/evals/${selectedId}`)
      .then((res) => {
        if (!cancelled) setSelectedCase(res.evalCase);
      })
      .catch(() => {
        if (!cancelled) setSelectedCase(null);
      });
    return () => {
      cancelled = true;
    };
  }, [cases, selectedId]);

  const createManual = useCallback(
    async (input: CreateManualEvalInput): Promise<EvalCase> => {
      const res = await api.post<EvalCaseResponse>("/api/user/evals", input);
      await reload();
      return res.evalCase;
    },
    [reload],
  );

  const createFromConversation = useCallback(
    async (input: CreateFromConversationInput): Promise<EvalCase> => {
      const res = await api.post<EvalCaseResponse>("/api/user/evals/from-conversation", {
        conversationId: input.conversationId,
        answerAnalysis: input.answerAnalysis,
        expectedGuidance: input.expectedGuidance,
        agentId: input.agentId,
      });
      return res.evalCase;
    },
    [],
  );

  const updateExpected = useCallback(
    async (id: string, expectedReply: string): Promise<EvalCase | null> => {
      const res = await api.put<EvalCaseResponse>(`/api/user/evals/${id}`, {
        expectedReply,
      });
      await reload();
      return res.evalCase;
    },
    [reload],
  );

  const updateTurns = useCallback(
    async (id: string, turns: EvalTurn[]): Promise<EvalCase | null> => {
      const res = await api.put<EvalCaseResponse>(`/api/user/evals/${id}`, { turns });
      setSelectedCase(res.evalCase);
      await reload();
      return res.evalCase;
    },
    [reload],
  );

  const updateDetails = useCallback(
    async (
      id: string,
      input: { title: string; expectedReply: string },
    ): Promise<EvalCase | null> => {
      const res = await api.put<EvalCaseResponse>(`/api/user/evals/${id}`, {
        title: input.title,
        expectedReply: input.expectedReply,
      });
      setSelectedCase(res.evalCase);
      await reload();
      return res.evalCase;
    },
    [reload],
  );

  const remove = useCallback(
    async (id: string): Promise<void> => {
      await api.delete(`/api/user/evals/${id}`);
      setSelectedCase((prev) => (prev?.id === id ? null : prev));
      await reload();
    },
    [reload],
  );

  const run = useCallback(
    async (id: string): Promise<EvalCase | null> => {
      if (runningLockRef.current) return null;
      runningLockRef.current = true;
      setRunningId(id);
      try {
        const res = await api.post<EvalCaseResponse>(`/api/user/evals/${id}/run`);
        setSelectedCase(res.evalCase);
        await reload();
        return res.evalCase;
      } finally {
        runningLockRef.current = false;
        setRunningId(null);
      }
    },
    [reload],
  );

  const setHasSchedule = useCallback((id: string, hasSchedule: boolean) => {
    setCases((prev) =>
      prev.map((item) => (item.id === id ? { ...item, hasSchedule } : item)),
    );
    setSelectedCase((prev) => (prev?.id === id ? { ...prev, hasSchedule } : prev));
  }, []);

  return {
    cases,
    total,
    loading,
    error,
    page,
    setPage,
    selectedCase,
    reload,
    createManual,
    createFromConversation,
    updateExpected,
    updateTurns,
    updateDetails,
    remove,
    run,
    runningId,
    setHasSchedule,
  };
}
