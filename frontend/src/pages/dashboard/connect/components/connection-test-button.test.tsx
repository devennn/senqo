import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { ConnectionTestButton } from "./connection-test-button";
import type { WhatsappConnectionCheckStatus } from "@/types/repositories";

describe("ConnectionTestButton", () => {
  // Happy path: a live check result is reported so the user can trust the "Authorized" state.
  it("shows the live message when the check reports connected", async () => {
    const user = userEvent.setup();
    render(
      <ConnectionTestButton connectionId="conn-1" onCheck={vi.fn().mockResolvedValue("connected")} />,
    );

    await user.click(screen.getByRole("button", { name: "Test connection" }));

    expect(await screen.findByText("Connection is live.")).toBeInTheDocument();
  });

  // Stale-card case: an offline result must tell the user what to do next (reconnect with a new QR).
  it("shows the offline guidance when the check reports disconnected", async () => {
    const user = userEvent.setup();
    render(
      <ConnectionTestButton connectionId="conn-1" onCheck={vi.fn().mockResolvedValue("disconnected")} />,
    );

    await user.click(screen.getByRole("button", { name: "Test connection" }));

    expect(
      await screen.findByText("This connection is offline. Reconnect with a new QR."),
    ).toBeInTheDocument();
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

  // While a check is in flight the button disables and shows the pending label so users cannot double-fire it.
  it("disables the button and shows the pending label while checking", async () => {
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

    expect(screen.getByRole("button", { name: "Testing…" })).toBeDisabled();
    resolveCheck("connected");
    expect(await screen.findByText("Connection is live.")).toBeInTheDocument();
  });
});
