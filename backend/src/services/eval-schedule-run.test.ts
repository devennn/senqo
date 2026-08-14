import { describe, it, expect, vi, beforeEach } from "vitest";

const isWorkspaceTeammate = vi.fn();
const findUserById = vi.fn();
const sendEvalScheduleFailureEmail = vi.fn();
const markEvalRunEmailSent = vi.fn();

vi.mock("../repositories/workspaces.js", () => ({
  isWorkspaceTeammate,
}));

vi.mock("../repositories/auth-users.js", () => ({
  findUserById,
}));

vi.mock("./email.js", () => ({
  sendEvalScheduleFailureEmail,
}));

vi.mock("../repositories/evals.js", () => ({
  getEvalCaseById: vi.fn(),
  markEvalRunEmailSent,
}));

vi.mock("../repositories/eval-schedules.js", () => ({
  getEvalScheduleByEvalCaseId: vi.fn(),
}));

vi.mock("./eval-run.js", () => ({
  runAndPersistEvalCase: vi.fn(),
}));

const { notifyEvalScheduleIfNeeded } = await import("./eval-schedule-run.js");

beforeEach(() => {
  vi.clearAllMocks();
  isWorkspaceTeammate.mockResolvedValue(true);
  findUserById.mockResolvedValue({ id: "user-1", email: "ops@example.com" });
  sendEvalScheduleFailureEmail.mockResolvedValue({ ok: true });
  markEvalRunEmailSent.mockResolvedValue({ ok: true });
});

const base = {
  workspaceId: "ws-1",
  evalCaseId: "eval-1",
  evalTitle: "Hours",
  runId: "run-1",
  notifyUserId: "user-1",
};

describe("notifyEvalScheduleIfNeeded", () => {
  // Failed scheduled run → SMTP + persist emailed address, needed so operators get fail mail.
  it("sends email when status is failed", async () => {
    await notifyEvalScheduleIfNeeded({ ...base, status: "failed" });

    expect(sendEvalScheduleFailureEmail).toHaveBeenCalledWith({
      to: "ops@example.com",
      workspaceId: "ws-1",
      evalCaseId: "eval-1",
      evalTitle: "Hours",
      status: "failed",
    });
    expect(markEvalRunEmailSent).toHaveBeenCalledWith("ws-1", "run-1", "ops@example.com");
  });

  // Runtime error → still emails, needed so infra failures are not silent.
  it("sends email when status is error", async () => {
    await notifyEvalScheduleIfNeeded({ ...base, status: "error" });

    expect(sendEvalScheduleFailureEmail).toHaveBeenCalledWith(
      expect.objectContaining({ status: "error" }),
    );
  });

  // Passed run → no email, needed so success does not notify.
  it("skips email when status is passed", async () => {
    await notifyEvalScheduleIfNeeded({ ...base, status: "passed" });

    expect(sendEvalScheduleFailureEmail).not.toHaveBeenCalled();
  });

  // Notify user left the workspace → skip send, needed so mail never goes to non-members.
  it("skips email when notify user is not a teammate", async () => {
    isWorkspaceTeammate.mockResolvedValue(false);

    await notifyEvalScheduleIfNeeded({ ...base, status: "failed" });

    expect(sendEvalScheduleFailureEmail).not.toHaveBeenCalled();
  });
});
