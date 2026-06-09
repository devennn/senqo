import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

const mockGet = vi.fn();
vi.mock("@/lib/api", () => ({
  api: { get: mockGet, post: vi.fn() },
}));

vi.mock("@/context/workspace", () => ({
  useWorkspace: () => ({ workspaceId: "ws-1", wsPath: (path: string) => path }),
}));

const { useTasks } = await import("@/hooks/useTasks");

const taskListResponse = {
  tasks: [
    {
      id: "t1",
      prompt: "Say hello",
      status: "active",
      agent: { id: "a1", profile_name: "Bot" },
    },
  ],
  agents: [{ id: "a1", profile_name: "Bot" }],
  total: 1,
  page: 1,
  pageSize: 25,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockGet.mockResolvedValue(taskListResponse);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useTasks", () => {
  it("fetches tasks with pagination", async () => {
    const query = { page: 1, search: "" };
    const { result } = renderHook(() => useTasks(query));
    await act(() => Promise.resolve());
    expect(result.current.tasks).toHaveLength(1);
    expect(result.current.tasks[0].prompt).toBe("Say hello");
    expect(result.current.total).toBe(1);
  });

  it("polls task list silently so run status updates without reloading the table", async () => {
    vi.useFakeTimers();
    const query = { page: 1, search: "" };
    const { result } = renderHook(() => useTasks(query));
    await act(() => Promise.resolve());
    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(result.current.loading).toBe(false);

    mockGet.mockResolvedValueOnce({
      ...taskListResponse,
      tasks: [
        {
          ...taskListResponse.tasks[0],
          last_run_status: "success",
          recent_runs: [{ status: "success", created_at: "2026-06-09T12:00:00.000Z" }],
        },
      ],
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    expect(mockGet).toHaveBeenCalledTimes(2);
    expect(result.current.loading).toBe(false);
    expect(result.current.tasks[0].last_run_status).toBe("success");
  });
});
