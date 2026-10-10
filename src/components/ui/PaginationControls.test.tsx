import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PaginationControls } from "./PaginationControls";

describe("PaginationControls", () => {
  it("offers 25, 50 and 100 rows without an option search", () => {
    render(<PaginationControls page={1} pageSize={25} total={186} onPageChange={vi.fn()} onPageSizeChange={vi.fn()} />);
    expect(screen.getByRole("combobox", { name: "Rows per page" })).toHaveValue("25");
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual(["25", "50", "100"]);
    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
    expect(screen.getByText("1-25")).toBeInTheDocument();
  });

  it("returns to the first page when changing row count", () => {
    const onPageChange = vi.fn();
    const onPageSizeChange = vi.fn();
    render(<PaginationControls page={7} pageSize={25} total={186} onPageChange={onPageChange} onPageSizeChange={onPageSizeChange} />);
    fireEvent.change(screen.getByRole("combobox", { name: "Rows per page" }), { target: { value: "100" } });
    expect(onPageChange).toHaveBeenCalledWith(1);
    expect(onPageSizeChange).toHaveBeenCalledWith(100);
  });

  it("disables navigation for empty results", () => {
    render(<PaginationControls page={1} pageSize={25} total={0} onPageChange={vi.fn()} onPageSizeChange={vi.fn()} />);
    expect(screen.getByText("0-0")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous page" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next page" })).toBeDisabled();
  });
});
