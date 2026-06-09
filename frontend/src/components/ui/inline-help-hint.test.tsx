import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InlineHelpHint } from "./inline-help-hint";

describe("inline-help-hint", () => {
  it("renders a help trigger button with aria-label", () => {
    render(
      <InlineHelpHint label="Learn more">
        <p>Extra details here.</p>
      </InlineHelpHint>,
    );

    expect(screen.getByRole("button", { name: "Learn more" })).toBeInTheDocument();
  });

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
