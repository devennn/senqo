import { describe, it, expect, vi, beforeEach } from "vitest";

const mockDb = {
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};

vi.mock("../db/index.js", () => ({
  db: mockDb,
}));

beforeEach(() => {
  vi.clearAllMocks();
});

const SCHEDULE_ROW = {
  id: "sched-1",
  workspaceId: "ws-1",
  evalCaseId: "eval-1",
  repeat: "weekly",
  weekdays: [0, 3],
  monthDay: null,
  hour: 20,
  minute: 0,
  timezone: "Asia/Kuala_Lumpur",
  notifyUserId: "user-1",
  enabled: true,
  lastFiredAt: null,
  createdAt: new Date("2026-08-13T00:00:00.000Z"),
  updatedAt: new Date("2026-08-13T00:00:00.000Z"),
};

describe("eval-schedules repository", () => {
  // Create with no existing row → insert returns id, needed so POST /schedule can persist.
  it("createEvalSchedule → returns ok true with id when none exists", async () => {
    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    });
    mockDb.insert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: "sched-1" }]),
      }),
    });

    const { createEvalSchedule } = await import("./eval-schedules.js");
    const result = await createEvalSchedule({
      workspaceId: "ws-1",
      evalCaseId: "eval-1",
      repeat: "weekly",
      weekdays: [0],
      monthDay: null,
      hour: 20,
      minute: 0,
      timezone: "Asia/Kuala_Lumpur",
      notifyUserId: "user-1",
    });

    expect(result).toEqual({ ok: true, id: "sched-1" });
  });

  // Existing schedule for the eval → exists, needed so POST returns 409 instead of duplicating.
  it("createEvalSchedule → returns exists when a schedule is already stored", async () => {
    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([SCHEDULE_ROW]),
        }),
      }),
    });

    const { createEvalSchedule } = await import("./eval-schedules.js");
    const result = await createEvalSchedule({
      workspaceId: "ws-1",
      evalCaseId: "eval-1",
      repeat: "daily",
      weekdays: [],
      monthDay: null,
      hour: 9,
      minute: 0,
      timezone: "UTC",
      notifyUserId: "user-1",
    });

    expect(result).toEqual({ ok: false, error: "exists" });
  });

  // Update matching row → ok true, needed so PUT /schedule persists cadence edits.
  it("updateEvalSchedule → returns ok true when a row is updated", async () => {
    mockDb.update.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: "sched-1" }]),
        }),
      }),
    });

    const { updateEvalSchedule } = await import("./eval-schedules.js");
    const result = await updateEvalSchedule("ws-1", "eval-1", {
      repeat: "daily",
      weekdays: [],
      monthDay: null,
      hour: 9,
      minute: 0,
      timezone: "UTC",
      notifyUserId: "user-1",
    });

    expect(result).toEqual({ ok: true });
  });

  // Disable an existing row → ok true, needed so Turn off stops the tick without deleting history.
  it("setEvalScheduleEnabled → returns ok true when a row is updated", async () => {
    mockDb.update.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: "sched-1" }]),
        }),
      }),
    });

    const { setEvalScheduleEnabled } = await import("./eval-schedules.js");
    const result = await setEvalScheduleEnabled("ws-1", "eval-1", false);

    expect(result).toEqual({ ok: true });
  });

  // Scheduled-runs query returns only the mocked scheduled row for that eval.
  it("listScheduledRunsPage → returns scheduled runs for that eval only", async () => {
    mockDb.select
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 1 }]),
        }),
      })
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          leftJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  offset: vi.fn().mockResolvedValue([
                    {
                      id: "run-1",
                      status: "failed",
                      actualReply: "Wrong hours.",
                      answerAnalysis: null,
                      reasoningForOperators: null,
                      handoffCalled: false,
                      handoffTopicEntryId: null,
                      handoffTopicLabel: null,
                      errorMessage: null,
                      subjectSessionId: null,
                      ranAt: new Date("2026-08-13T09:00:00.000Z"),
                      emailSent: true,
                      notifyEmail: "ops@example.com",
                    },
                  ]),
                }),
              }),
            }),
          }),
        }),
      });

    const { listScheduledRunsPage } = await import("./eval-schedules.js");
    const result = await listScheduledRunsPage({
      workspaceId: "ws-1",
      evalCaseId: "eval-1",
      page: 1,
      pageSize: 5,
    });

    expect(result.total).toBe(1);
    expect(result.items).toEqual([
      {
        id: "run-1",
        status: "failed",
        actualReply: "Wrong hours.",
        answerAnalysis: null,
        reasoningForOperators: null,
        handoffCalled: false,
        handoffTopicEntryId: null,
        handoffTopicLabel: null,
        errorMessage: null,
        subjectSessionId: null,
        ranAt: "2026-08-13T09:00:00.000Z",
        emailSent: true,
        notifyEmail: "ops@example.com",
      },
    ]);
  });
});
