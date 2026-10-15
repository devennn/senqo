import { describe, it, expect, vi, beforeEach } from "vitest";

const mockListAllEvalSchedules = vi.fn();
const mockClaimEvalScheduleSlot = vi.fn();

vi.mock("../repositories/eval-schedules.js", () => ({
  listAllEvalSchedules: mockListAllEvalSchedules,
  claimEvalScheduleSlot: mockClaimEvalScheduleSlot,
}));

const { tickEvalSchedules } = await import("./eval-schedule-tick.js");

const NOW = new Date("2026-10-15T09:30:00.000Z");

function schedule(overrides: Record<string, unknown>) {
  return {
    id: "sched-1",
    workspaceId: "ws-1",
    evalCaseId: "eval-1",
    repeat: "daily",
    weekdays: [],
    monthDay: null,
    hour: 9,
    minute: 30,
    timezone: "UTC",
    notifyUserId: null,
    enabled: true,
    lastFiredAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    agentConfigId: "agent-1",
    evalsEnabled: true,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockClaimEvalScheduleSlot.mockResolvedValue({ ok: true });
});

describe("tickEvalSchedules", () => {
  // An agent-level off switch pauses its schedule even though the schedule
  // itself is still on: nothing is claimed and no run is queued for it.
  it("skips a due schedule whose agent has evals off", async () => {
    mockListAllEvalSchedules.mockResolvedValue([
      schedule({ id: "sched-off", evalCaseId: "eval-off", evalsEnabled: false }),
    ]);

    const due = await tickEvalSchedules(NOW);

    expect(due).toEqual([]);
    expect(mockClaimEvalScheduleSlot).not.toHaveBeenCalled();
  });

  // A due schedule for an agent with evals on still fires, so the master switch
  // only pauses agents that were turned off.
  it("fires a due schedule when agent evals are on", async () => {
    mockListAllEvalSchedules.mockResolvedValue([schedule({})]);

    const due = await tickEvalSchedules(NOW);

    expect(due).toEqual([
      { workspaceId: "ws-1", evalCaseId: "eval-1", scheduleId: "sched-1" },
    ]);
    expect(mockClaimEvalScheduleSlot).toHaveBeenCalledWith(
      "sched-1",
      expect.any(Date),
      NOW,
    );
  });
});
