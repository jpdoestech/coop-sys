import { describe, expect, it } from "vitest";
import type { Employee } from "../../types/employee";
import type { PaymentLedger } from "../../types/payment";
import { buildPaymentSummary } from "./paymentSummary";

describe("buildPaymentSummary", () => {
  it("includes linked employees without payments and calculates balances", () => {
    const employees = [{ id: "e1", member_id: "m1", active_assignment: null }, { id: "e2", member_id: "m2", active_assignment: null }] as Employee[];
    const ledger = { settings: [{ effective_from: "2020-01-01", effective_to: null, membership_fee_centavos: 50000, capital_share_target_centavos: 500000 }], payments: [{ employee_id: "e1", payment_date: "2026-01-15", membership_fee_centavos: 50000, capital_share_centavos: 500000, amount_centavos: 550000 }] } as PaymentLedger;
    const rows = buildPaymentSummary(employees, ledger, [], [], 2026, 2026);
    expect(rows[0]).toMatchObject({ status: "Paid", totalBalanceCentavos: 0 });
    expect(rows[1]).toMatchObject({ status: "Unpaid", totalBalanceCentavos: 550000 });
  });
});
