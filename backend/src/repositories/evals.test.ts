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

describe("evals repository", () => {
  // Manual create with valid payload → insert returns id and ok:true, needed so create API can persist ready cases.
  it("createManualEvalCase → returns ok true with id under successful insert", async () => {
    mockDb.insert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: "eval-1" }]),
      }),
    });

    const { createManualEvalCase } = await import("./evals.js");
    const result = await createManualEvalCase({
      workspaceId: "ws-1",
      agentConfigId: "agent-1",
      title: "Hours",
      userMessage: "What are your hours?",
      expectedReply: "9–6 SGT",
    });

    expect(result).toEqual({ ok: true, id: "eval-1" });
  });

  // Insert throws → ok:false, needed so callers surface create failures without crashing.
  it("createManualEvalCase → returns ok false when insert throws", async () => {
    mockDb.insert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockRejectedValue(new Error("db down")),
      }),
    });

    const { createManualEvalCase } = await import("./evals.js");
    const result = await createManualEvalCase({
      workspaceId: "ws-1",
      agentConfigId: "agent-1",
      title: "Hours",
      userMessage: "What are your hours?",
      expectedReply: "9–6 SGT",
    });

    expect(result).toEqual({ ok: false });
  });

  // parseEvalTurns drops invalid roles and keeps media/sources, needed so JSONB turns stay safe for UI/subject.
  it("parseEvalTurns → keeps valid turns and drops invalid roles", async () => {
    const { parseEvalTurns } = await import("./evals.js");
    const turns = parseEvalTurns([
      { role: "user", content: "Hi" },
      { role: "system", content: "nope" },
      {
        role: "assistant",
        content: "Hello",
        whyReply: "Greeting",
        sources: [{ kind: "skill", label: "Greeting" }],
      },
    ]);

    expect(turns).toEqual([
      { role: "user", content: "Hi" },
      {
        role: "assistant",
        content: "Hello",
        whyReply: "Greeting",
        sources: [{ kind: "skill", label: "Greeting" }],
      },
    ]);
  });
});
