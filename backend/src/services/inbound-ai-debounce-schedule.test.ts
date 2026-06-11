import { describe, it, expect, vi, beforeEach } from "vitest";

const mockScheduleInboundAiDebouncedJob = vi.fn();

vi.mock("./job-scheduler.js", () => ({
  scheduleInboundAiDebouncedJob: mockScheduleInboundAiDebouncedJob,
}));

const { scheduleInboundAiDebounced } = await import("./inbound-ai-debounce-schedule.js");

const input = {
  workspaceId: "ws-1",
  conversationId: "conv-1",
  agentConfigId: "agent-1",
};

beforeEach(() => {
  vi.clearAllMocks();
  mockScheduleInboundAiDebouncedJob.mockResolvedValue(undefined);
});

describe("scheduleInboundAiDebounced", () => {
  // Inbound conversation event triggers debounced AI scheduling → the underlying job scheduler is called with the correct conversation input, needed to verify the debounce layer delegates to the job queue correctly.
  it("schedules debounced inbound via job queue", async () => {
    await scheduleInboundAiDebounced(input);

    expect(mockScheduleInboundAiDebouncedJob).toHaveBeenCalledWith(input);
  });
});
