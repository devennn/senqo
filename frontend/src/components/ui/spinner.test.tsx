import { render, screen } from "@testing-library/react";
import { Spinner, PageLoader } from "./spinner";

describe("Spinner", () => {
  it("renders loading indicator with role status and aria-label Loading", () => {
    render(<Spinner />);
    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-label", "Loading");
  });
});

describe("PageLoader", () => {
  it('renders with default Loading… label', () => {
    render(<PageLoader />);
    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });

  it("renders with custom label", () => {
    render(<PageLoader label="Please wait…" />);
    expect(screen.getByText("Please wait…")).toBeInTheDocument();
  });
});
