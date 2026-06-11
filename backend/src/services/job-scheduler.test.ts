import { describe, it, expect, vi, beforeEach } from "vitest";

const mockCancel = vi.fn();
const mockSend = vi.fn();
const mockSendAfter = vi.fn();

vi.mock("../lib/job-queue.js", () => ({
  getBoss: () => ({
    cancel: mockCancel,
    send: mockSend,
    sendAfter: mockSendAfter,
  }),
  QUEUE_INBOUND_AI: "inbound-ai",
  QUEUE_TASK_EXECUTE: "task-execute",
}));

const mockGetPendingJobId = vi.fn();
const mockUpsertPending = vi.fn();

vi.mock("../repositories/inbound-ai-debounce-pending.js", () => ({
  getInboundAiDebouncePendingJobId: mockGetPendingJobId,
  upsertInboundAiDebouncePending: mockUpsertPending,
}));

vi.mock("../lib/env.js", () => ({
  env: { inboundAiDebounceSeconds: 7 },
}));

const { scheduleAgentTask, cancelScheduledTask, scheduleInboundAiDebouncedJob } =
  await import("../services/job-scheduler.js");

beforeEach(() => {
  vi.clearAllMocks();
  mockSend.mockResolvedValue("job-new-1");
  mockSendAfter.mockResolvedValue("job-task-1");
  mockCancel.mockResolvedValue(undefined);
  mockUpsertPending.mockResolvedValue(true);
});

describe("scheduleAgentTask", () => {
  // oneTimeAt is in the future → sendAfter is called to delay task execution, needed to verify that future-dated tasks are scheduled with the correct delay.
  it("enqueues delayed task with sendAfter when oneTimeAt is in the future", async () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    const result = await scheduleAgentTask({
      workspaceId: "ws-1",
      agentConfigId: "agent-1",
      prompt: "Hello",
      cronExpression: null,
      oneTimeAt: future,
      taskId: "task-1",
    });

    expect(mockSendAfter).toHaveBeenCalled();
    expect(result.payload).toEqual({ jobId: "job-task-1", queue: "task-execute" });
  });
});

describe("cancelScheduledTask", () => {
  // Payload has a valid jobId → the corresponding job is cancelled, needed to verify that pg-boss cancel is called for trackable jobs.
  it("cancels job when jobId is present in payload", async () => {
    await cancelScheduledTask({ jobId: "job-1", queue: "task-execute" });
    expect(mockCancel).toHaveBeenCalledWith("task-execute", "job-1");
  });

  // Payload lacks jobId (legacy qstash format) → no cancel is attempted, needed to handle legacy payloads that aren't tracked by pg-boss job ids.
  it("no-ops when jobId is missing (legacy qstash payload)", async () => {
    await cancelScheduledTask({ response: { messageId: "old-qstash" } });
    expect(mockCancel).not.toHaveBeenCalled();
  });
});

describe("scheduleInboundAiDebouncedJob", () => {
  // A previous pending job exists for the conversation → it is cancelled before scheduling a new one, the new job is sent with debounce delay, and the pending record is upserted, needed to verify the full debounce loop: cancel-old, send-new, track.
  it("cancels previous pending job before scheduling a new one", async () => {
    mockGetPendingJobId.mockResolvedValue("job-old-1");

    await scheduleInboundAiDebouncedJob({
      workspaceId: "ws-1",
      conversationId: "conv-1",
      agentConfigId: "agent-1",
    });

    expect(mockCancel).toHaveBeenCalledWith("inbound-ai", "job-old-1");
    expect(mockSend).toHaveBeenCalledWith(
      "inbound-ai",
      expect.objectContaining({ conversationId: "conv-1" }),
      expect.objectContaining({ startAfter: 7, singletonKey: "conv-1" }),
    );
    expect(mockUpsertPending).toHaveBeenCalledWith({
      conversationId: "conv-1",
      workspaceId: "ws-1",
      pendingJobId: "job-new-1",
    });
  });
});
