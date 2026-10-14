import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PayrollNavigation } from "./PayrollNavigation";
describe("compact payroll navigation", () => {
  it("keeps only three primary views and shows setup categories only in Settings", () => {
    const onView = vi.fn(), onKind = vi.fn();
    const { rerender } = render(<PayrollNavigation view="runs" kind="worksite" onView={onView} onKind={onKind} />);
    expect(within(screen.getByRole("navigation")).getAllByRole("button")).toHaveLength(3);
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Settings" })); expect(onView).toHaveBeenCalledWith("settings");
    rerender(<PayrollNavigation view="settings" kind="worksite" onView={onView} onKind={onKind} />);
    fireEvent.change(screen.getByRole("combobox", { name: "Payroll settings" }), { target: { value: "client_terms" } });
    expect(onKind).toHaveBeenCalledWith("client_terms");
  });
});
