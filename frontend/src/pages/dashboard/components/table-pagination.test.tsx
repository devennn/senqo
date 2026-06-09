import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { TablePagination } from "./table-pagination";

describe("table-pagination", () => {
  it("renders Previous and Next buttons", () => {
    render(
      <TablePagination page={2} total={50} pageSize={10} onPage={vi.fn()} />,
    );
    expect(screen.getByRole("button", { name: "Previous" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next" })).toBeInTheDocument();
  });

  it("shows correct page info", () => {
    render(
      <TablePagination page={1} total={25} pageSize={10} onPage={vi.fn()} />,
    );
    expect(screen.getByText("Showing 1–10 of 25")).toBeInTheDocument();
  });

  it("calls onPage when Next button clicked", async () => {
    const user = userEvent.setup();
    const onPage = vi.fn();
    render(
      <TablePagination page={1} total={50} pageSize={10} onPage={onPage} />,
    );
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(onPage).toHaveBeenCalledWith(2);
  });

  it("calls onPage when Previous button clicked", async () => {
    const user = userEvent.setup();
    const onPage = vi.fn();
    render(
      <TablePagination page={3} total={50} pageSize={10} onPage={onPage} />,
    );
    await user.click(screen.getByRole("button", { name: "Previous" }));
    expect(onPage).toHaveBeenCalledWith(2);
  });

  it("disables Previous on first page", () => {
    render(
      <TablePagination page={1} total={50} pageSize={10} onPage={vi.fn()} />,
    );
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
  });
});
