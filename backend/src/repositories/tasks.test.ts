import { describe, it, expect, vi, beforeEach } from "vitest";

const mockReturning = vi.fn();
const mockWhere = vi.fn();
const mockFrom = vi.fn();
const mockOrderBy = vi.fn();
const mockSet = vi.fn();
const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });

const mockDb = {
  select: vi.fn().mockReturnValue({ from: mockFrom }),
  insert: vi.fn().mockReturnValue({ values: mockValues }),
  update: vi.fn().mockReturnValue({ set: mockSet }),
  delete: vi.fn(),
};

vi.mock("../db/index.js", () => ({ db: mockDb }));

const { createTask, cancelTaskById, listSchedulableAgents } =
  await vi.importActual("../repositories/tasks.js") as typeof import("../repositories/tasks.js");

beforeEach(() => { vi.clearAllMocks(); });

describe("createTask", () => {
  it("inserts with schedule, prompt, contact, file URL", async () => {
    mockReturning.mockResolvedValue([{ id: "task-1" }]);
    const result = await createTask({
      id: "task-1",
      workspaceId: "ws-1",
      agentConfigId: "a1",
      leadId: "lead-1",
      prompt: "Say hello",
      fileUrl: "https://example.com/file.csv",
      scheduleType: "one_time",
      oneTimeAt: "2025-01-01T00:00:00Z",
      timezone: "UTC",
      jobPayload: {},
      source: "user",
      dailyContactLimit: 100,
    });
    expect(result.ok).toBe(true);
    expect(result.id).toBe("task-1");
  });

  it("returns ok false on error", async () => {
    mockReturning.mockRejectedValue(new Error("db down"));
    const result = await createTask({
      id: "t1",
      workspaceId: "ws-1",
      agentConfigId: "a1",
      prompt: "test",
      scheduleType: "recurring",
      cronExpression: "0 * * * *",
      timezone: "UTC",
      jobPayload: {},
      source: "user",
    });
    expect(result.ok).toBe(false);
  });
});

describe("cancelTaskById", () => {
  it("marks cancelled and returns true", async () => {
    mockSet.mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
    const result = await cancelTaskById("ws-1", "task-1");
    expect(result).toBe(true);
  });

  it("returns false on error", async () => {
    mockSet.mockReturnValue({ where: vi.fn().mockRejectedValue(new Error("fail")) });
    const result = await cancelTaskById("ws-1", "task-1");
    expect(result).toBe(false);
  });
});

describe("listSchedulableAgents", () => {
  it("returns agents attached to a WhatsApp connection", async () => {
    const innerJoin = vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        orderBy: vi.fn().mockResolvedValue([{ id: "a1", profileName: "Bot" }]),
      }),
    });
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({ innerJoin }),
    });
    const result = await listSchedulableAgents("ws-1");
    expect(result).toHaveLength(1);
    expect(result[0].profile_name).toBe("Bot");
  });

  it("returns workspace agents when authorized WhatsApp exists without attachment", async () => {
    const innerJoin = vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        orderBy: vi.fn().mockResolvedValue([]),
      }),
    });
    const connectionFrom = vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue([
        { status: "pending_qr", lastStateInstance: "authorized" },
      ]),
    });
    const agentFrom = vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        orderBy: vi.fn().mockResolvedValue([{ id: "a1", profileName: "Bot" }]),
      }),
    });
    mockDb.select
      .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ innerJoin }) })
      .mockReturnValueOnce({ from: connectionFrom })
      .mockReturnValueOnce({ from: agentFrom });
    const result = await listSchedulableAgents("ws-1");
    expect(result).toHaveLength(1);
    expect(result[0].profile_name).toBe("Bot");
  });
});
