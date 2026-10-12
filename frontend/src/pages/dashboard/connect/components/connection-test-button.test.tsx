import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { ConnectionTestButton } from "./connection-test-button";
import type { WhatsappConnectionCheckStatus } from "@/types/repositories";

describe("ConnectionTestButton", () => {
  // Happy path: a live check result shows a green tick on the button and is announced to screen readers.
  it("shows a green tick and announces the live result when connected", async () => {
    const user = userEvent.setup();
    render(
      <ConnectionTestButton connectionId="conn-1" onCheck={vi.fn().mockResolvedValue("connected")} />,
    );

    await user.click(screen.getByRole("button", { name: "Test connection" }));

    expect(await screen.findByTestId("connection-test-ok")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Connection is live.");
  });

  // Stale-card case: the card itself flips to Not Authorized with its own offline note, so the button
  // must not repeat that message — the check just runs and finishes.
  it("does not repeat the card's offline note when the check reports disconnected", async () => {
    const user = userEvent.setup();
    render(
      <ConnectionTestButton connectionId="conn-1" onCheck={vi.fn().mockResolvedValue("disconnected")} />,
    );

    await user.click(screen.getByRole("button", { name: "Test connection" }));

    expect(screen.queryByText(/This connection is offline/)).not.toBeInTheDocument();
    expect(screen.getByRole("status").textContent).toBe("");
  });

  // Error path: a failed check request must not crash the card — it reports the service as unreachable.
  it("shows the unavailable message when the check request fails", async () => {
    const user = userEvent.setup();
    render(
      <ConnectionTestButton
        connectionId="conn-1"
        onCheck={vi.fn().mockRejectedValue(new Error("HTTP 500"))}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Test connection" }));

    expect(
      await screen.findByText("Couldn't reach the WhatsApp service. Try again."),
    ).toBeInTheDocument();
  });

  // While a check is in flight the icon button disables so users cannot double-fire it, then reports the result.
  it("disables the button while checking and reports the result after", async () => {
    const user = userEvent.setup();
    let resolveCheck!: (status: WhatsappConnectionCheckStatus) => void;
    const onCheck = vi.fn(
      () =>
        new Promise<WhatsappConnectionCheckStatus>((resolve) => {
          resolveCheck = resolve;
        }),
    );
    render(<ConnectionTestButton connectionId="conn-1" onCheck={onCheck} />);

    await user.click(screen.getByRole("button", { name: "Test connection" }));

    expect(screen.getByRole("button", { name: "Test connection" })).toBeDisabled();
    resolveCheck("connected");
    expect(await screen.findByTestId("connection-test-ok")).toBeInTheDocument();
  });
});
