import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetEvalCaseById = vi.fn();
const mockCreateEvalRun = vi.fn();
const mockUpdateEvalCase = vi.fn();
const mockGetAgentConfigById = vi.fn();
const mockRunEvalCase = vi.fn();

vi.mock("../repositories/evals.js", () => ({
  getEvalCaseById: mockGetEvalCaseById,
  createEvalRun: mockCreateEvalRun,
  updateEvalCase: mockUpdateEvalCase,
}));

vi.mock("../repositories/agent.js", () => ({
  getAgentConfigById: mockGetAgentConfigById,
}));

vi.mock("../agent-evals/index.js", () => ({
  runEvalCase: mockRunEvalCase,
}));

const { runAndPersistEvalCase } = await import("./eval-run.js");

const CASE = {
  id: "eval-1",
  agentId: "agent-1",
  expectedAction: "reply",
  expectedReply: "9 to 5",
  expectedTopicEntryId: null,
  expectedTopicLabel: null,
  turns: [],
  title: "Hours",
};

beforeEach(() => {
  vi.clearAllMocks();
  mockGetEvalCaseById.mockResolvedValue(CASE);
});

describe("runAndPersistEvalCase agent evals switch", () => {
  // Agent-level off must block the run before any model call, so schedules and
  // manual Run both stop.
  it("returns agent_evals_off without running when the agent has evals off", async () => {
    mockGetAgentConfigById.mockResolvedValue({ evals_enabled: false });

    const result = await runAndPersistEvalCase({
      workspaceId: "ws-1",
      evalCaseId: "eval-1",
    });

    expect(result).toEqual({
      ok: false,
      error: "agent_evals_off",
      httpStatus: 400,
    });
    expect(mockRunEvalCase).not.toHaveBeenCalled();
  });

  // A missing agent (for example archived) also blocks the run rather than
  // evaluating against an agent the workspace no longer lists.
  it("blocks the run when the agent cannot be found", async () => {
    mockGetAgentConfigById.mockResolvedValue(null);

    const result = await runAndPersistEvalCase({
      workspaceId: "ws-1",
      evalCaseId: "eval-1",
    });

    expect(result.ok).toBe(false);
    expect(mockRunEvalCase).not.toHaveBeenCalled();
  });

  // With evals on the run proceeds through the subject loop as before.
  it("runs the case when agent evals are on", async () => {
    mockGetAgentConfigById.mockResolvedValue({ evals_enabled: true });
    mockRunEvalCase.mockResolvedValue({
      status: "passed",
      sessionId: "sess-1",
      actualReply: "9 to 5",
      reasoningForOperators: null,
      handoffCalled: false,
      handoffTopicEntryId: null,
      answerAnalysis: null,
      errorMessage: null,
    });
    mockCreateEvalRun.mockResolvedValue({ ok: true, id: "run-1" });

    const result = await runAndPersistEvalCase({
      workspaceId: "ws-1",
      evalCaseId: "eval-1",
    });

    expect(mockRunEvalCase).toHaveBeenCalled();
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.runId).toBe("run-1");
  });
});
