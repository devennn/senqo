import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InlineHelpHint } from "./inline-help-hint";

describe("inline-help-hint", () => {
  // Confirms the InlineHelpHint renders a button with the correct accessible label.
  // Ensures the help trigger is discoverable by screen readers and assistive technologies.
  it("renders a help trigger button with aria-label", () => {
    render(
      <InlineHelpHint label="Learn more">
        <p>Extra details here.</p>
      </InlineHelpHint>,
    );

    expect(screen.getByRole("button", { name: "Learn more" })).toBeInTheDocument();
  });

  // Verifies that clicking the button shows the tooltip content in a portal.
  // Ensures the explanatory copy (i-button pattern per DESIGN.md) is accessible on user action.
  it("shows tooltip content when button clicked", async () => {
    const user = userEvent.setup();

    render(
      <InlineHelpHint label="Learn more">
        <p>Extra details here.</p>
      </InlineHelpHint>,
    );

    await user.click(screen.getByRole("button", { name: "Learn more" }));

    await waitFor(() => {
      expect(screen.getByText("Extra details here.")).toBeInTheDocument();
    });
  });
});
