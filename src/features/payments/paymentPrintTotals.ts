import { formatPesos } from "../../services/payments/paymentMath";
import type { PaymentSummaryItem } from "../../services/repositories/PaymentRepository";

export function paymentPrintTotals(rows: Pick<PaymentSummaryItem, "membershipFeeCentavos" | "capitalShareCentavos" | "totalPaidCentavos" | "refundCentavos" | "retainedCapitalShareCentavos" | "overpaidCentavos">[]) {
  const sum = (key: keyof typeof rows[number]) => rows.reduce((total, row) => total + row[key], 0);
  const fee = sum("membershipFeeCentavos"), capital = sum("capitalShareCentavos"), paid = sum("totalPaidCentavos"), refund = sum("refundCentavos"), overpaid = sum("overpaidCentavos");
  return {
    fee: formatPesos(fee), capital: formatPesos(capital), paid: formatPesos(paid),
    summary: [
      { label: "Total Payments", value: formatPesos(paid) },
      ...(refund > 0 ? [{ label: "Total Refund", value: formatPesos(refund) }] : []),
      { label: "Net Payments", value: formatPesos(paid - refund) },
      { label: "Total Share Capital (excluding membership fee)", value: formatPesos(sum("retainedCapitalShareCentavos")) },
      ...(overpaid > 0 ? [{ label: "Remaining Overpayment", value: formatPesos(overpaid) }] : []),
    ],
  };
}
