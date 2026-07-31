import { describe, it, expect, vi, beforeEach } from "vitest";

const mockLimit = vi.fn();
const mockWhere = vi.fn();
const mockFrom = vi.fn();
const mockInnerJoin = vi.fn();

const mockDb = {
  select: vi.fn().mockReturnValue({ from: mockFrom }),
};

vi.mock("../db/index.js", () => ({ db: mockDb }));

describe("validateHandoffTopicEntryForAgent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({ where: mockWhere });
    mockWhere.mockReturnValue({ limit: mockLimit });
  });

  // Entry belongs to an attached group → ok:true so the handoff tool can persist the id.
  it("returns ok true when entry is on an agent-attached group", async () => {
    mockLimit
      .mockResolvedValueOnce([{ handoffTopicGroups: ["group-1"] }])
      .mockResolvedValueOnce([{ id: "entry-1", groupId: "group-1" }]);

    // Second query uses innerJoin
    mockFrom.mockReturnValueOnce({ where: mockWhere }).mockReturnValueOnce({
      innerJoin: mockInnerJoin.mockReturnValue({ where: mockWhere }),
    });

    const { validateHandoffTopicEntryForAgent } = await import("./handoff-topic-groups.js");
    const result = await validateHandoffTopicEntryForAgent("ws-1", "agent-1", "entry-1");
    expect(result).toEqual({ ok: true });
  });

  // Agent has no attached groups → reject before looking up the entry.
  it("returns ok false when agent has no handoff groups", async () => {
    mockLimit.mockResolvedValueOnce([{ handoffTopicGroups: [] }]);

    const { validateHandoffTopicEntryForAgent } = await import("./handoff-topic-groups.js");
    const result = await validateHandoffTopicEntryForAgent("ws-1", "agent-1", "entry-1");
    expect(result).toEqual({
      ok: false,
      message: "Topic is not attached to this agent.",
    });
  });

  // Entry not found under attached groups → reject so invalid ids are not stored.
  it("returns ok false when entry is unknown or unattached", async () => {
    mockLimit
      .mockResolvedValueOnce([{ handoffTopicGroups: ["group-1"] }])
      .mockResolvedValueOnce([]);
    mockFrom.mockReturnValueOnce({ where: mockWhere }).mockReturnValueOnce({
      innerJoin: mockInnerJoin.mockReturnValue({ where: mockWhere }),
    });

    const { validateHandoffTopicEntryForAgent } = await import("./handoff-topic-groups.js");
    const result = await validateHandoffTopicEntryForAgent(
      "ws-1",
      "agent-1",
      "22222222-2222-4222-8222-222222222222",
    );
    expect(result).toEqual({
      ok: false,
      message: "Unknown or unattached handoff topic.",
    });
  });
});
