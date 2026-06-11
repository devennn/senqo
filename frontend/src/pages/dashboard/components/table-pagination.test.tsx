import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { TablePagination } from "./table-pagination";

describe("table-pagination", () => {
  // The pagination component must render both Previous and Next navigation buttons.
  it("renders Previous and Next buttons", () => {
    render(
      <TablePagination page={2} total={50} pageSize={10} onPage={vi.fn()} />,
    );
    expect(screen.getByRole("button", { name: "Previous" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next" })).toBeInTheDocument();
  });

  // The component must show the current range and total, e.g. "Showing 1–10 of 25" for page 1 with pageSize 10.
  it("shows correct page info", () => {
    render(
      <TablePagination page={1} total={25} pageSize={10} onPage={vi.fn()} />,
    );
    expect(screen.getByText("Showing 1–10 of 25")).toBeInTheDocument();
  });

  // Clicking Next must call onPage with the next page number (page + 1).
  it("calls onPage when Next button clicked", async () => {
    const user = userEvent.setup();
    const onPage = vi.fn();
    render(
      <TablePagination page={1} total={50} pageSize={10} onPage={onPage} />,
    );
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(onPage).toHaveBeenCalledWith(2);
  });

  // Clicking Previous must call onPage with the previous page number (page - 1).
  it("calls onPage when Previous button clicked", async () => {
    const user = userEvent.setup();
    const onPage = vi.fn();
    render(
      <TablePagination page={3} total={50} pageSize={10} onPage={onPage} />,
    );
    await user.click(screen.getByRole("button", { name: "Previous" }));
    expect(onPage).toHaveBeenCalledWith(2);
  });

  // The Previous button must be disabled when already on the first page to prevent going below page 1.
  it("disables Previous on first page", () => {
    render(
      <TablePagination page={1} total={50} pageSize={10} onPage={vi.fn()} />,
    );
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
  });
});
