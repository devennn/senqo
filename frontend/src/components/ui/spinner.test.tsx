import { render, screen } from "@testing-library/react";
import { Spinner, PageLoader } from "./spinner";

describe("Spinner", () => {
  // Confirms the Spinner renders with role="status" and aria-label="Loading".
  // Ensures screen readers can announce loading state to assistive technology users.
  it("renders loading indicator with role status and aria-label Loading", () => {
    render(<Spinner />);
    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-label", "Loading");
  });
});

describe("PageLoader", () => {
  // Verifies PageLoader shows the default "Loading…" label when no custom label is provided.
  // Ensures the page-level loading state always displays clear feedback text.
  it('renders with default Loading… label', () => {
    render(<PageLoader />);
    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });

  // Confirms PageLoader renders a custom label when one is provided.
  // Ensures callers can show context-specific loading messages (e.g. "Loading dashboard…").
  it("renders with custom label", () => {
    render(<PageLoader label="Please wait…" />);
    expect(screen.getByText("Please wait…")).toBeInTheDocument();
  });
});
