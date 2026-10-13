import { describe, expect, it } from "vitest";
import { paymentPrintTotals } from "./paymentPrintTotals";
describe("payment print totals", () => {
  it("keeps gross amounts separate from refunded and retained capital", () => {
    const totals = paymentPrintTotals([{ membershipFeeCentavos: 125000, capitalShareCentavos: 1090000, totalPaidCentavos: 1215000, refundCentavos: 665000, retainedCapitalShareCentavos: 500000, overpaidCentavos: 0 }]);
    expect(totals.summary.find((item) => item.label === "Total Refund")?.value).toContain("6,650.00");
    expect(totals.summary.find((item) => item.label.startsWith("Total Share Capital"))?.value).toContain("5,000.00");
    expect(totals.paid).toContain("12,150.00");
    expect(totals.summary.find((item) => item.label === "Gross Payments")?.value).toContain("12,150.00");
    expect(totals.summary.find((item) => item.label === "Total Payments")?.value).toContain("5,500.00");
  });
  it("omits a refund line when none exists", () => {
    expect(paymentPrintTotals([]).summary.some((item) => item.label === "Total Refund")).toBe(false);
  });
});
