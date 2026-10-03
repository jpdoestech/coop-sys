import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PaymentImportPanel } from "./PaymentImportPanel";

describe("PaymentImportPanel", () => {
  it("derives payroll month from the cut-off date and still allows an override", () => {
    render(<PaymentImportPanel employees={[]} aliases={[]} branches={[]} clients={[]} userId="user-1" saving={false} onSaveAlias={vi.fn()} onPost={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("Cut-off from"), { target: { value: "2026-03-10" } });
    expect(screen.getByLabelText("Payroll month")).toHaveValue("3");

    fireEvent.change(screen.getByLabelText("Payroll month"), { target: { value: "4" } });
    expect(screen.getByLabelText("Payroll month")).toHaveValue("4");
  });
});
