import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PaymentSummaryPanel } from "./PaymentSummaryPanel";
import type { PaymentSummaryItem } from "../../../services/repositories/PaymentRepository";

const employee: PaymentSummaryItem = {
  employeeId: "e", employeeNumber: "000001", firstName: "Shiela", middleName: null, lastName: "Abella", suffix: null,
  branchId: null, branchLabel: null, clientId: null, clientLabel: null,
  firstPayment: "2026-01-07", lastPayment: "2026-10-12", membershipFeeCentavos: 125000, capitalShareCentavos: 1090000,
  totalPaidCentavos: 1215000, refundCentavos: 540000, netPaidCentavos: 675000, overpaidCentavos: 125000,
  retainedCapitalShareCentavos: 625000, totalBalanceCentavos: 0, status: "Overpaid",
};

describe("payment summary refresh", () => {
  it("reloads actual totals rather than retaining a stale unpaid row", async () => {
    const load = vi.fn().mockResolvedValueOnce({ items: [{ ...employee, status: "Unpaid", overpaidCentavos: 0 }], total: 1 })
      .mockResolvedValue({ items: [employee], total: 1, overpaidTotal: 1 });
    render(<PaymentSummaryPanel branches={[]} clients={[]} batches={[]} onLoadSummary={load} onLoadEmployeeLedger={vi.fn()} />);
    await screen.findByText("Unpaid");
    fireEvent.click(screen.getByRole("button", { name: "Refresh payment summary" }));
    await screen.findByText("Overpaid");
    expect(screen.getByText("Overpaid")).toHaveClass("bg-red-50");
    expect(screen.getByText("1 employee has an overpayment in this summary.")).toBeInTheDocument();
    expect(load).toHaveBeenCalledTimes(2);
    expect(screen.getByLabelText("Payment summary scope")).toHaveTextContent(`${new Date().getFullYear()} / All periods`);
  });

  it("refreshes when the payment ledger is invalidated after a transaction", async () => {
    const load = vi.fn().mockResolvedValue({ items: [employee], total: 1, overpaidTotal: 1 });
    const props = { branches: [], clients: [], batches: [], onLoadSummary: load, onLoadEmployeeLedger: vi.fn() };
    const view = render(<PaymentSummaryPanel {...props} refreshVersion={1} />);
    await screen.findByText("Overpaid");
    view.rerender(<PaymentSummaryPanel {...props} refreshVersion={2} />);
    await waitFor(() => expect(load).toHaveBeenCalledTimes(2));
  });
});
