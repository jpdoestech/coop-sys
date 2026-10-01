import type { MemberPayment, PaymentSettings } from "../../types/payment";

export function pesosToCentavos(value: string | number) {
  const amount = typeof value === "number" ? value : Number(String(value).replace(/[,\s₱]/g, ""));
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("Amount must be greater than zero.");
  return Math.round(amount * 100);
}

export function formatPesos(centavos: number) {
  return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(centavos / 100);
}

export function allocatePayment(
  amountCentavos: number,
  settings: PaymentSettings,
  previousPayments: Pick<MemberPayment, "membership_fee_centavos">[],
) {
  const feePaid = previousPayments.reduce((sum, payment) => sum + payment.membership_fee_centavos, 0);
  const feeBalance = Math.max(0, settings.membership_fee_centavos - feePaid);
  const membershipFeeCentavos = Math.min(amountCentavos, feeBalance);
  return {
    membershipFeeCentavos,
    capitalShareCentavos: amountCentavos - membershipFeeCentavos,
  };
}

export function effectiveSettings(settings: PaymentSettings[], date: string) {
  return [...settings]
    .filter((item) => item.is_active && item.effective_from <= date && (!item.effective_to || item.effective_to >= date))
    .sort((a, b) => b.effective_from.localeCompare(a.effective_from))[0] ?? null;
}
