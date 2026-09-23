import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

const mockGet = vi.fn();

vi.mock("@/lib/api", () => ({
  api: { get: (...args: unknown[]) => mockGet(...args) },
}));

const { useConversationReports } = await import("@/hooks/useConversationReports");

beforeEach(() => {
  vi.clearAllMocks();
  mockGet.mockResolvedValue({
    reports: [
      {
        id: "report-1",
        conversationId: "conv-1",
        conversationName: "Amara Okafor",
        contactName: null,
        reason: "Wrong refund policy",
        reportedByName: "User One",
        agentId: null,
        agentName: null,
        createdAt: "2026-07-15T12:00:00.000Z",
      },
    ],
    total: 1,
  });
});

describe("useConversationReports", () => {
  // Fetches the reported-conversations listing with date window + pagination.
  it("fetches the reported conversations page", async () => {
    const { result } = renderHook(() =>
      useConversationReports({
        range: { from: "2026-07-01", to: "2026-07-31" },
        page: 2,
        pageSize: 7,
      }),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockGet).toHaveBeenCalledWith(
      "/api/user/reports/conversation-reports?from=2026-07-01&to=2026-07-31&limit=7&offset=7",
    );
    expect(result.current.reports).toHaveLength(1);
    expect(result.current.reports[0].reason).toBe("Wrong refund policy");
    expect(result.current.total).toBe(1);
    expect(result.current.error).toBeNull();
  });

  // A selected agent is forwarded so the tab can scope to one agent.
  it("forwards the agentId filter when set", async () => {
    renderHook(() =>
      useConversationReports({
        range: { from: "2026-07-01", to: "2026-07-31" },
        agentId: "agent-1",
        page: 1,
        pageSize: 7,
      }),
    );
    await waitFor(() =>
      expect(mockGet).toHaveBeenCalledWith(
        "/api/user/reports/conversation-reports?from=2026-07-01&to=2026-07-31&agentId=agent-1&limit=7&offset=0",
      ),
    );
  });

  // API failure surfaces an error and clears rows for the empty/error states.
  it("sets error when the API request fails", async () => {
    mockGet.mockRejectedValueOnce(new Error("network"));
    const { result } = renderHook(() =>
      useConversationReports({
        range: { from: "2026-07-01", to: "2026-07-31" },
        page: 1,
        pageSize: 7,
      }),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe("Could not load reported conversations.");
    expect(result.current.reports).toEqual([]);
    expect(result.current.total).toBe(0);
  });
});