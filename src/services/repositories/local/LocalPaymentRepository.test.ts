import { afterEach, describe, expect, it } from "vitest";
import { LocalPaymentRepository } from "./LocalPaymentRepository";
import { effectiveSettings } from "../../payments/paymentMath";

afterEach(() => localStorage.clear());

describe("LocalPaymentRepository corrections and refunds", () => {
  it("updates settings saved on the same effective date", async () => {
    const repository = new LocalPaymentRepository();
    await repository.saveSettings({
      membership_fee_centavos: 50000,
      capital_share_target_centavos: 600000,
      effective_from: "2026-10-03",
    });
    await repository.saveSettings({
      membership_fee_centavos: 50000,
      capital_share_target_centavos: 500000,
      effective_from: "2026-10-03",
    });

    const ledger = await repository.getLedger();
    expect(
      ledger.settings.filter(
        (setting) => setting.effective_from === "2026-10-03",
      ),
    ).toHaveLength(1);
    expect(
      effectiveSettings(ledger.settings, "2026-10-03")
        ?.capital_share_target_centavos,
    ).toBe(500000);
  });

  it("returns payment summaries as a repository-paged result", async () => {
    const repository = new LocalPaymentRepository();
    const firstPage = await repository.getPaymentSummary({
      yearFrom: 2026,
      yearTo: 2026,
      sortBy: "employee",
      sortDirection: "asc",
      limit: 2,
      offset: 0,
    });
    const secondPage = await repository.getPaymentSummary({
      yearFrom: 2026,
      yearTo: 2026,
      sortBy: "employee",
      sortDirection: "asc",
      limit: 2,
      offset: 2,
    });

    expect(firstPage.items).toHaveLength(2);
    expect(firstPage.total).toBeGreaterThan(firstPage.items.length);
    expect(secondPage.total).toBe(firstPage.total);
    expect(secondPage.items[0].employeeId).not.toBe(
      firstPage.items[0].employeeId,
    );
  });

  it("audits imported amount changes, reallocates the payment, and stores refunds", async () => {
    const repository = new LocalPaymentRepository();
    const posted = await repository.postBatch(
      {
        branch_id: "branch-1",
        client_id: "client-1",
        method: "payroll_deduction",
        cutoff_from: "2026-01-01",
        cutoff_to: "2026-01-15",
        payroll_month: 1,
        payment_date: "2026-01-15",
        source_file_name: "payroll.xlsx",
        remarks: null,
        created_by: "user-1",
      },
      [
        {
          employee_id: "employee-1",
          member_id: "member-1",
          amount_centavos: 60000,
          remarks: "Imported",
        },
      ],
    );

    const corrected = await repository.correctPayment({
      payment_id: posted.payments[0].id,
      amount_centavos: 40000,
      remarks: "Corrected payroll",
      comment: "From: PHP 600.00; To: PHP 400.00",
      corrected_by: "user-1",
    });
    expect(corrected.correction.from_amount_centavos).toBe(60000);
    expect(corrected.correction.to_amount_centavos).toBe(40000);
    expect(corrected.payment.membership_fee_centavos).toBe(40000);
    expect(corrected.payment.capital_share_centavos).toBe(0);

    const manual = await repository.postBatch(
      {
        branch_id: "branch-1",
        client_id: "client-1",
        method: "manual",
        cutoff_from: null,
        cutoff_to: null,
        payroll_month: null,
        payment_date: "2026-01-18",
        source_file_name: null,
        remarks: null,
        created_by: "user-1",
      },
      [
        {
          employee_id: "employee-1",
          member_id: "member-1",
          amount_centavos: 20000,
          remarks: "Counter payment",
        },
      ],
    );
    const correctedManual = await repository.correctPayment({
      payment_id: manual.payments[0].id,
      amount_centavos: 15000,
      remarks: "Corrected counter payment",
      comment: "Encoding correction",
      corrected_by: "user-1",
    });
    expect(correctedManual.payment.amount_centavos).toBe(15000);

    await repository.saveRefund({
      employee_id: "employee-1",
      member_id: "member-1",
      branch_id: "branch-1",
      client_id: "client-1",
      amount_centavos: 5000,
      refund_date: "2026-01-20",
      cutoff_from: "2026-01-01",
      cutoff_to: "2026-01-15",
      method: "manual",
      source_file_name: null,
      remarks: "Over deduction",
      created_by: "user-1",
    });
    const ledger = await repository.getLedger({
      yearFrom: 2026,
      yearTo: 2026,
      branchIds: ["branch-1"],
    });
    const refundPage = await repository.getRefundPage({
      branchIds: ["branch-1"],
      limit: 10,
      offset: 0,
    });
    expect(ledger.corrections).toHaveLength(2);
    expect(ledger.refunds).toHaveLength(1);
    expect(ledger.paymentTotal).toBe(2);
    expect(refundPage.total).toBe(1);
    expect(refundPage.items).toHaveLength(1);
  });
});
