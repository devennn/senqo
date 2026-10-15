import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { EvalSchedulePanel } from "./eval-schedule-panel";

vi.mock("@/hooks/useEvalSchedule", () => ({
  EVAL_SUITE_RUN_PAGE_SIZE: 5,
  useEvalSchedule: () => ({
    draft: {
      repeat: "daily",
      weekdays: [],
      monthDay: 1,
      time: "09:00",
      timezone: "UTC",
      notifyUserId: "",
    },
    setDraft: vi.fn(),
    members: [],
    created: true,
    enabled: true,
    canSubmit: false,
    saving: false,
    saved: false,
    submit: vi.fn(),
    setEnabled: vi.fn(),
    runs: [],
    page: 1,
    setPage: vi.fn(),
    total: 0,
  }),
}));

describe("EvalSchedulePanel agent evals off", () => {
  // The paused note must show while the agent's evals are off because the
  // per-eval schedule keeps its own switch but will not fire.
  it("shows the paused note when the agent's evals are off", () => {
    render(<EvalSchedulePanel evalId="eval-1" evalsOff />);

    expect(
      screen.getByText(
        "Agent evals are off — schedules are paused until the agent is turned on again.",
      ),
    ).toBeInTheDocument();
  });

  // Without the master switch the schedule UI is unchanged.
  it("hides the paused note when agent evals are on", () => {
    render(<EvalSchedulePanel evalId="eval-1" />);

    expect(screen.queryByText(/Agent evals are off/)).not.toBeInTheDocument();
  });
});
