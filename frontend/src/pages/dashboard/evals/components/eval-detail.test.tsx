import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { EvalDetail } from "./eval-detail";
import type { EvalCase } from "@/types/evals";

const evalCase: EvalCase = {
  id: "eval-1",
  title: "Hours",
  agentId: "a1",
  agentName: "Support",
  source: "manual",
  status: "ready",
  turns: [{ role: "user", content: "Hours?" }],
  expectedReply: "9 to 5",
  expectedAction: "reply",
  expectedTopicEntryId: null,
  expectedTopicLabel: null,
  expectedTopicDescription: null,
  answerAnalysis: null,
  answerCorrect: null,
  sourceConversationId: null,
  runs: [],
  hasSchedule: false,
  createdAt: "2026-01-01T00:00:00.000Z",
};

const baseProps = {
  onSaveExpected: vi.fn(),
  onSaveTurns: vi.fn(),
  onSaveDetails: vi.fn(),
  onDelete: vi.fn(),
  onRun: vi.fn(),
};

describe("EvalDetail agent evals off", () => {
  // Run must be blocked while the agent's evals are off, with a banner telling
  // operators how to resume — this is the visible half of the master switch.
  it("disables Run and shows the off note", () => {
    render(<EvalDetail evalCase={evalCase} {...baseProps} evalsOff />);

    expect(screen.getByRole("button", { name: "Run eval" })).toBeDisabled();
    expect(
      screen.getByText("Agent evals are off — turn them on in the sidebar to run evals."),
    ).toBeInTheDocument();
  });

  // With agent evals on the Run button stays usable and no banner is shown.
  it("keeps Run enabled when agent evals are on", () => {
    render(<EvalDetail evalCase={evalCase} {...baseProps} />);

    expect(screen.getByRole("button", { name: "Run eval" })).toBeEnabled();
    expect(screen.queryByText(/Agent evals are off/)).not.toBeInTheDocument();
  });
});
