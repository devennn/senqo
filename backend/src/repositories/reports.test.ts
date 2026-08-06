import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSelect = vi.fn();
const mockDb = {
  select: (...args: unknown[]) => mockSelect(...args),
};

vi.mock("../db/index.js", () => ({ db: mockDb }));

function chainSelect(rows: unknown[]) {
  const chain: Record<string, unknown> = {};
  const self = () => chain;
  chain.from = vi.fn(self);
  chain.innerJoin = vi.fn(self);
  chain.where = vi.fn(self);
  chain.groupBy = vi.fn(self);
  chain.orderBy = vi.fn(self);
  chain.limit = vi.fn(async () => rows);
  // Terminal thenable when awaited without limit
  chain.then = (resolve: (v: unknown) => unknown) => Promise.resolve(rows).then(resolve);
  return chain;
}

describe("getAgentPerformanceReport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelect.mockReset();
  });

  // Empty workspace → agents/topics empty and zero summary, needed for first-run reports UI.
  it("returns empty agents and topics when workspace has no data", async () => {
    mockSelect
      .mockReturnValueOnce(chainSelect([])) // agents
      .mockReturnValueOnce(chainSelect([])) // ai agg
      .mockReturnValueOnce(chainSelect([])) // handoff agg
      .mockReturnValueOnce(chainSelect([])) // human agg
      .mockReturnValueOnce(chainSelect([])); // topic agg

    const { getAgentPerformanceReport } = await import("./reports.js");
    const result = await getAgentPerformanceReport("ws-1", "2026-07-01", "2026-07-31");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.report.agents).toEqual([]);
    expect(result.report.topics).toEqual([]);
    expect(result.report.summary).toEqual({
      conversationsHandled: 0,
      aiReplies: 0,
      handoffs: 0,
      inHumanMode: 0,
    });
  });

  // Seeded agent with AI + handoff aggregates → metrics map onto that agent row.
  it("maps AI reply and handoff aggregates onto listed agents", async () => {
    mockSelect
      .mockReturnValueOnce(
        chainSelect([{ id: "agent-1", profileName: "Front desk" }]),
      )
      .mockReturnValueOnce(
        chainSelect([
          { agentId: "agent-1", aiReplies: 12, conversationsHandled: 5 },
        ]),
      )
      .mockReturnValueOnce(chainSelect([{ agentId: "agent-1", handoffs: 3 }]))
      .mockReturnValueOnce(chainSelect([{ agentId: "agent-1", inHumanMode: 2 }]))
      .mockReturnValueOnce(chainSelect([]));

    const { getAgentPerformanceReport } = await import("./reports.js");
    const result = await getAgentPerformanceReport("ws-1", "2026-07-01", "2026-07-31");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.report.agents).toEqual([
      {
        id: "agent-1",
        name: "Front desk",
        conversationsHandled: 5,
        aiReplies: 12,
        handoffs: 3,
        inHumanMode: 2,
      },
    ]);
    expect(result.report.summary.handoffs).toBe(3);
  });

  // Topic aggregates without a known entry id → No topic bucket for unmatched handoffs.
  it("rolls unmatched topic entry ids into No topic", async () => {
    mockSelect
      .mockReturnValueOnce(chainSelect([{ id: "agent-1", profileName: "Bot" }]))
      .mockReturnValueOnce(chainSelect([]))
      .mockReturnValueOnce(chainSelect([]))
      .mockReturnValueOnce(chainSelect([]))
      .mockReturnValueOnce(
        chainSelect([
          { entryId: null, handoffs: 4 },
          { entryId: "11111111-1111-4111-8111-111111111111", handoffs: 2 },
        ]),
      )
      .mockReturnValueOnce(
        chainSelect([
          {
            id: "11111111-1111-4111-8111-111111111111",
            topicName: "Refund request",
            groupName: "Billing",
            groupId: "group-1",
          },
        ]),
      );

    const { getAgentPerformanceReport } = await import("./reports.js");
    const { REPORTS_NO_TOPIC_LABEL, REPORTS_OTHER_TOPIC_ID } = await import("../types/reports.js");
    const result = await getAgentPerformanceReport("ws-1", "2026-07-01", "2026-07-31");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.report.topics).toEqual([
      {
        id: REPORTS_OTHER_TOPIC_ID,
        topicName: REPORTS_NO_TOPIC_LABEL,
        groupName: "-",
        groupId: null,
        handoffs: 4,
      },
      {
        id: "11111111-1111-4111-8111-111111111111",
        topicName: "Refund request",
        groupName: "Billing",
        groupId: "group-1",
        handoffs: 2,
      },
    ]);
  });

  // DB failure → ok:false so the route can return 500.
  it("returns ok false on unexpected DB error", async () => {
    mockSelect.mockImplementation(() => {
      throw new Error("db down");
    });

    const { getAgentPerformanceReport } = await import("./reports.js");
    const result = await getAgentPerformanceReport("ws-1", "2026-07-01", "2026-07-31");
    expect(result).toEqual({ ok: false, message: "db down" });
  });
});

describe("reportDateBounds", () => {
  // Inclusive UTC day bounds — verifies to covers the full end day.
  it("uses start of from day and end of to day in UTC", async () => {
    const { reportDateBounds } = await import("./reports.js");
    const { fromDate, toDate } = reportDateBounds("2026-07-01", "2026-07-31");
    expect(fromDate.toISOString()).toBe("2026-07-01T00:00:00.000Z");
    expect(toDate.toISOString()).toBe("2026-07-31T23:59:59.999Z");
  });
});
