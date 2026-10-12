import { describe, expect, it } from "vitest";
import { assertRefundAmount, finalPayBalance, paymentBalance, refundableBalance } from "./paymentBalance";
import type { PaymentLedger, PaymentSettings } from "../../types/payment";

const settings = { membership_fee_centavos: 50000, capital_share_target_centavos: 500000, effective_from: "2020-01-01", effective_to: null } as PaymentSettings;
describe("refund-aware payment balances", () => {
  it("does not return refunded excess again in final pay", () => {
    const ledger = { payments: [{ member_id: "m", amount_centavos: 1215000, membership_fee_centavos: 125000, capital_share_centavos: 1090000, payment_date: "2026-01-01" }], refunds: [{ member_id: "m", amount_centavos: 665000 }] } as PaymentLedger;
    expect(finalPayBalance(ledger.payments, ledger.refunds, [settings], "m", "2026-10-12")).toEqual({ fee: 50000, capital: 500000 });
  });
  it("distinguishes unpaid, exact payment and overpayment", () => {
    expect(paymentBalance(549999, 0, settings).status).toBe("Unpaid");
    expect(paymentBalance(550000, 0, settings).status).toBe("Paid");
    expect(paymentBalance(550001, 0, settings)).toMatchObject({ status: "Overpaid", overpaidCentavos: 1, totalBalanceCentavos: 0 });
  });
  it("settles excess using refunds without counting the membership fee as capital", () => {
    expect(paymentBalance(1095000, 540000, settings)).toMatchObject({ status: "Overpaid", overpaidCentavos: 5000, retainedCapitalShareCentavos: 505000 });
    expect(paymentBalance(1095000, 545000, settings)).toMatchObject({ status: "Paid", retainedCapitalShareCentavos: 500000 });
  });
  it("uses configured obligations rather than hardcoding 5500", () => {
    expect(paymentBalance(550000, 0, { ...settings, capital_share_target_centavos: 600000 })).toMatchObject({ status: "Unpaid", totalBalanceCentavos: 100000 });
    expect(paymentBalance(600000, 0, null).status).toBe("Unpaid");
  });
  it("excludes the edited refund but reserves all other refunds and ignores future payments", () => {
    const ledger = { payments: [{ employee_id: "e", amount_centavos: 650000, payment_date: "2026-01-01" }, { employee_id: "e", amount_centavos: 100000, payment_date: "2027-01-01" }], refunds: [{ id: "r1", employee_id: "e", amount_centavos: 50000 }, { id: "r2", employee_id: "e", amount_centavos: 20000 }] } as PaymentLedger;
    expect(refundableBalance(ledger.payments, ledger.refunds, [settings], "e", "2026-01-15")).toBe(30000);
    expect(refundableBalance(ledger.payments, ledger.refunds, [settings], "e", "2026-01-15", "r1")).toBe(80000);
    expect(() => assertRefundAmount(30001, 30000)).toThrow("cannot exceed");
    expect(() => assertRefundAmount(1, 0)).toThrow("Only employees");
    expect(() => assertRefundAmount(-1, 30000)).toThrow("greater than zero");
    expect(() => assertRefundAmount(30000, 30000)).not.toThrow();
  });
});
