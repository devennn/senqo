import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EvalsSidebar } from "./evals-sidebar";
import type { EvalAgentOption } from "@/types/evals";

const agents: EvalAgentOption[] = [
  { id: "a1", name: "Support", evalsEnabled: true },
  { id: "a2", name: "Sales", evalsEnabled: false },
];

const baseProps = {
  agents,
  agentId: "a1",
  agentsLoading: false,
  onAgentChange: vi.fn(),
  agentEvalsEnabled: true,
  togglingEvals: false,
  onToggleEvals: vi.fn(),
  evalsOff: false,
  cases: [],
  selectedId: null,
  loading: false,
  page: 1,
  total: 0,
  onPage: vi.fn(),
  onSelect: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("EvalsSidebar agent evals switch", () => {
  // Agents with evals off render gray in the picker so operators can still tell
  // them apart now that the option label is just the agent name.
  it("grays an agent with evals off in the picker", () => {
    render(<EvalsSidebar {...baseProps} />);

    expect(screen.getByRole("option", { name: "Support" })).toBeInTheDocument();
    const offOption = screen.getByRole("option", { name: "Sales" });
    expect(offOption).toBeInTheDocument();
    expect(offOption).toHaveClass("text-muted-foreground");
  });

  // Clicking Turn off while the agent's evals are on asks the page to persist
  // the master switch for the whole agent.
  it("turns the master switch off through the callback", async () => {
    const user = userEvent.setup();
    render(<EvalsSidebar {...baseProps} />);

    await user.click(screen.getByRole("button", { name: "Turn off" }));

    expect(baseProps.onToggleEvals).toHaveBeenCalledTimes(1);
  });

  // Hovering the switch immediately explains its purpose, needed so operators
  // know it affects every eval of the agent, not just the selected case.
  it("shows the purpose hint on hover", async () => {
    const user = userEvent.setup();
    render(<EvalsSidebar {...baseProps} />);

    await user.hover(screen.getByRole("button", { name: "Turn off" }));

    expect(
      await screen.findByRole("tooltip", {
        name: "Turn off all evals for this agent — pauses schedules and blocks Run",
      }),
    ).toBeInTheDocument();
  });

  // While the agent's evals are off the control offers to resume them and is
  // disabled during the in-flight save.
  it("shows Turn on and disables it while saving", () => {
    render(
      <EvalsSidebar {...baseProps} agentEvalsEnabled={false} evalsOff togglingEvals />,
    );

    expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
  });
});
