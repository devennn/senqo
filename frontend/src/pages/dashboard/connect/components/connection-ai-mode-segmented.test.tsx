import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ConnectionAiModeSegmented } from "@/pages/dashboard/connect/components/connection-ai-mode-segmented";

describe("ConnectionAiModeSegmented", () => {
  // Dry run is a first-class mode: the control must offer it and report the
  // selection so admins can switch a line to draft-only replies.
  it("offers Dry run and reports the selection", () => {
    const onChange = vi.fn();
    render(<ConnectionAiModeSegmented mode="live" onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Dry run" }));

    expect(onChange).toHaveBeenCalledWith("dry_run");
  });

  // The active mode is exposed as pressed for assistive tech, needed so operators
  // can tell which mode the line is currently in.
  it("marks the active mode as pressed", () => {
    render(<ConnectionAiModeSegmented mode="dry_run" onChange={() => {}} />);

    expect(screen.getByRole("button", { name: "Dry run" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Live" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });
});
