import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import type { ReactNode } from "react";
import type { EvalCase } from "@/types/evals";

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children, open }: { children: ReactNode; open: boolean }) =>
    open ? <div role="dialog">{children}</div> : null,
  DialogContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
}));

import { EvalExpectedDock } from "./eval-expected-dock";

const LONG_EXPECTED = ["Line 1", "Line 2", "Line 3", "Line 4", "Line 5"].join("\n");
const LONG_ANALYSIS = ["Analysis 1", "Analysis 2", "Analysis 3", "Analysis 4", "Analysis 5"].join(
  "\n",
);

function createEvalCase(overrides: Partial<EvalCase> = {}): EvalCase {
  return {
    id: "eval-1",
    title: "Delivery platforms",
    agentId: "agent-1",
    agentName: "Support",
    source: "manual",
    status: "ready",
    turns: [{ role: "user", content: "Do you deliver?" }],
    expectedReply: "Yes.",
    expectedAction: "reply",
    expectedTopicEntryId: null,
    expectedTopicLabel: null,
    expectedTopicDescription: null,
    answerAnalysis: "Looks good.",
    answerCorrect: true,
    sourceConversationId: null,
    runs: [],
    hasSchedule: false,
    createdAt: "2026-08-08T04:00:00.000Z",
    ...overrides,
  };
}

describe("EvalExpectedDock", () => {
  // Short expected reply and analysis fit in the 4-line preview, so no faded View full affordance.
  it("EvalExpectedDock → hides View full under short single-line text", () => {
    render(<EvalExpectedDock evalCase={createEvalCase()} onSaveExpected={vi.fn()} />);

    expect(screen.queryByRole("button", { name: "View full" })).not.toBeInTheDocument();
  });

  // Five explicit lines exceed the preview cap, so faded text shows a View cue.
  it("EvalExpectedDock → shows View cue when expected or analysis has more than 4 lines", () => {
    render(
      <EvalExpectedDock
        evalCase={createEvalCase({ expectedReply: LONG_EXPECTED, answerAnalysis: LONG_ANALYSIS })}
        onSaveExpected={vi.fn()}
      />,
    );

    expect(screen.getAllByRole("button", { name: "View full" }).length).toBeGreaterThan(0);
    expect(screen.getAllByText("View").length).toBeGreaterThan(0);
  });

  // Clicking the faded preview opens one modal with both dock sections.
  it("EvalExpectedDock → opens a dual-pane modal from the faded text preview", async () => {
    const user = userEvent.setup();
    render(
      <EvalExpectedDock
        evalCase={createEvalCase({ expectedReply: LONG_EXPECTED, answerAnalysis: LONG_ANALYSIS })}
        onSaveExpected={vi.fn()}
      />,
    );

    await user.click(screen.getAllByRole("button", { name: "View full" })[0]);

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Expected reply and answer analysis")).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Expected reply")).toHaveValue(LONG_EXPECTED);
    expect(within(dialog).getByText("Answer analysis")).toBeInTheDocument();
    expect(within(dialog).getByText("Analysis 1", { exact: false })).toBeInTheDocument();
  });
});
