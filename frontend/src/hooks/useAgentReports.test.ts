import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

const mockGet = vi.fn();

vi.mock("@/lib/api", () => ({
  api: { get: (...args: unknown[]) => mockGet(...args) },
}));

const { useAgentReports } = await import("@/hooks/useAgentReports");

const report = {
  agents: [
    {
      id: "agent-1",
      name: "Front desk",
      conversationsHandled: 10,
      aiReplies: 20,
      handoffs: 2,
      inHumanMode: 1,
    },
  ],
  topics: [
    {
      id: "topic-1",
      topicName: "Refund request",
      groupName: "Billing",
      handoffs: 2,
    },
  ],
  summary: {
    totalConversations: 12,
    conversationsHandled: 10,
    totalMessages: 40,
    aiReplies: 20,
    handoffs: 2,
    inHumanMode: 1,
    technicalErrors: 1,
    reportedErrors: 2,
  },
  agentOptions: [{ id: "agent-1", name: "Front desk" }],
};

beforeEach(() => {
  vi.clearAllMocks();
  mockGet.mockResolvedValue(report);
});

describe("useAgentReports", () => {
  // Fetches the reports API with from/to and exposes agents, topics, and summary.
  it("fetches report for the date range", async () => {
    const { result } = renderHook(() =>
      useAgentReports({ from: "2026-07-02", to: "2026-07-31" }),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockGet).toHaveBeenCalledWith(
      "/api/user/reports/agents?from=2026-07-02&to=2026-07-31",
    );
    expect(result.current.agents).toHaveLength(1);
    expect(result.current.agents[0].name).toBe("Front desk");
    expect(result.current.topics[0].topicName).toBe("Refund request");
    expect(result.current.summary.handoffs).toBe(2);
    expect(result.current.error).toBeNull();
  });

  // API failure surfaces an error and clears rows so the page can show a failure state.
  it("sets error when the API request fails", async () => {
    mockGet.mockRejectedValueOnce(new Error("network"));
    const { result } = renderHook(() =>
      useAgentReports({ from: "2026-07-02", to: "2026-07-31" }),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe("Could not load reports.");
    expect(result.current.agents).toEqual([]);
    expect(result.current.topics).toEqual([]);
  });

  // Changing the range triggers a new fetch with updated query params.
  it("refetches when from/to change", async () => {
    const { result, rerender } = renderHook(
      ({ range }) => useAgentReports(range),
      { initialProps: { range: { from: "2026-07-02", to: "2026-07-31" } } },
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockGet).toHaveBeenCalledTimes(1);

    await act(async () => {
      rerender({ range: { from: "2026-07-25", to: "2026-07-31" } });
    });
    await waitFor(() =>
      expect(mockGet).toHaveBeenCalledWith(
        "/api/user/reports/agents?from=2026-07-25&to=2026-07-31",
      ),
    );
  });

  // A selected agent is forwarded as agentId; no param when unscoped.
  it("forwards the agentId filter when provided", async () => {
    const { result, rerender } = renderHook(
      ({ agentId }) => useAgentReports({ from: "2026-07-02", to: "2026-07-31" }, agentId),
      { initialProps: { agentId: undefined as string | undefined } },
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockGet).toHaveBeenCalledWith("/api/user/reports/agents?from=2026-07-02&to=2026-07-31");

    await act(async () => {
      rerender({ agentId: "agent-1" });
    });
    await waitFor(() =>
      expect(mockGet).toHaveBeenCalledWith(
        "/api/user/reports/agents?from=2026-07-02&to=2026-07-31&agentId=agent-1",
      ),
    );
    expect(result.current.agentOptions).toEqual([{ id: "agent-1", name: "Front desk" }]);
  });
});
