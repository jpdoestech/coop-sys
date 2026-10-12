import type { MemberPayment, OverDeductionRefund, PaymentSettings } from "../../types/payment";
import { effectiveSettings, formatPesos } from "./paymentMath";

export type PaymentStatus = "Paid" | "Unpaid" | "Overpaid";

export function paymentBalance(totalPaidCentavos: number, refundCentavos: number, settings: PaymentSettings | null) {
  const obligationCentavos = settings ? settings.membership_fee_centavos + settings.capital_share_target_centavos : 0;
  const netPaidCentavos = totalPaidCentavos - refundCentavos;
  const overpaidCentavos = settings ? Math.max(0, netPaidCentavos - obligationCentavos) : 0;
  const retainedMembershipFeeCentavos = settings ? Math.min(Math.max(0, netPaidCentavos), settings.membership_fee_centavos) : 0;
  return {
    refundCentavos, netPaidCentavos, overpaidCentavos, retainedMembershipFeeCentavos,
    retainedCapitalShareCentavos: Math.max(0, netPaidCentavos - retainedMembershipFeeCentavos),
    totalBalanceCentavos: Math.max(0, obligationCentavos - netPaidCentavos),
    status: (overpaidCentavos > 0 ? "Overpaid" : obligationCentavos > 0 && netPaidCentavos === obligationCentavos ? "Paid" : "Unpaid") as PaymentStatus,
  };
}

export function refundableBalance(payments: MemberPayment[], refunds: OverDeductionRefund[], settings: PaymentSettings[], employeeId: string, date: string, excludingRefundId?: string) {
  return paymentBalance(
    payments.filter((item) => !item.deleted_at && item.employee_id === employeeId && item.payment_date <= date).reduce((sum, item) => sum + item.amount_centavos, 0),
    refunds.filter((item) => !item.deleted_at && item.employee_id === employeeId && item.id !== excludingRefundId).reduce((sum, item) => sum + item.amount_centavos, 0),
    effectiveSettings(settings, date),
  ).overpaidCentavos;
}

export function assertRefundAmount(amount: number, available: number) {
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error("Refund amount must be greater than zero.");
  if (available <= 0) throw new Error("Only employees with an outstanding overpayment are eligible for an over-deduction refund.");
  if (amount > available) throw new Error(`Refund cannot exceed the remaining overpayment of ${formatPesos(available)}.`);
}

export function finalPayBalance(payments: MemberPayment[], refunds: OverDeductionRefund[], settings: PaymentSettings[], memberId: string, date: string) {
  const memberPayments = payments.filter((item) => !item.deleted_at && item.member_id === memberId && item.payment_date <= date);
  const paid = memberPayments.reduce((sum, item) => sum + item.amount_centavos, 0);
  const refunded = refunds.filter((item) => !item.deleted_at && item.member_id === memberId).reduce((sum, item) => sum + item.amount_centavos, 0);
  const configured = effectiveSettings(settings, date);
  const net = Math.max(0, paid - refunded);
  const fee = Math.min(net, configured?.membership_fee_centavos ?? memberPayments.reduce((sum, item) => sum + item.membership_fee_centavos, 0));
  return { fee, capital: net - fee };
}

export const paymentStatusClass = (status: PaymentStatus) => status === "Overpaid" ? "bg-red-50 text-red-700" : status === "Paid" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700";
