import { describe, expect, it } from "vitest";
import type { Employee } from "../../types/employee";
import type { PaymentLedger } from "../../types/payment";
import { EMPLOYMENT_STATUS } from "../lookups/statuses";
import { buildPaymentExportData } from "./paymentExport";

const employee = {
  id: "employee-1", employee_number: "000001", first_name: "Juan", middle_name: "Andres", last_name: "Dela Cruz", suffix: null,
  employment_status_id: EMPLOYMENT_STATUS.active,
} as Employee;
const terminatedEmployee = {
  ...employee, id: "employee-2", employee_number: "000002", first_name: "Maria", middle_name: null, last_name: "Santos", employment_status_id: EMPLOYMENT_STATUS.terminated,
} as Employee;

const ledger = {
  settings: [], aliases: [], settlements: [], paymentTotal: 3,
  batches: [
    { id: "batch-1", branch_id: "branch-1", client_id: "client-1", cutoff_from: "2021-01-01", cutoff_to: "2021-01-15" },
    { id: "batch-2", branch_id: "branch-1", client_id: "client-2", cutoff_from: "2021-01-16", cutoff_to: "2021-01-31" },
    { id: "batch-3", branch_id: "branch-2", client_id: "client-3", cutoff_from: "2022-02-01", cutoff_to: "2022-02-15" },
    { id: "batch-4", branch_id: "branch-1", client_id: "client-2", cutoff_from: "2021-01-01", cutoff_to: "2021-01-15" },
  ],
  payments: [
    { id: "payment-1", batch_id: "batch-1", employee_id: employee.id, payment_date: "2021-01-15", amount_centavos: 5000 },
    { id: "payment-2", batch_id: "batch-2", employee_id: employee.id, payment_date: "2021-01-31", amount_centavos: 7500 },
    { id: "payment-3", batch_id: "batch-3", employee_id: employee.id, payment_date: "2022-02-15", amount_centavos: 10000 },
    { id: "payment-4", batch_id: "batch-4", employee_id: employee.id, payment_date: "2021-01-18", amount_centavos: 2500 },
  ],
} as unknown as PaymentLedger;

describe("buildPaymentExportData", () => {
  it("uses actual years and aggregates the strict yearly, monthly, and period layouts", () => {
    const result = buildPaymentExportData([employee], ledger, {
      scope: "all", branchId: "", clientIds: [], employeeId: "", employmentStatusIds: [], allowedBranchIds: ["branch-1", "branch-2"],
    }, ["PAYMENT_YEARLY", "PAYMENT_MONTHLY", "PAYMENT_PERIOD"]);

    expect(result.firstYear).toBe(2021);
    expect(result.lastYear).toBe(2022);
    expect(result.sheets[0].headers).toEqual(["ID", "NAME", 2021, 2022, "STATUS", "REMARKS", "DATE"]);
    expect(result.sheets[0].rows[0].slice(0, 4)).toEqual(["000001", "DELA CRUZ, JUAN A.", 150, 100]);
    expect(result.sheets[1].rows[0].slice(0, 5)).toEqual(["000001", "DELA CRUZ, JUAN A.", 2021, 150, null]);
    expect(result.sheets[2].headers.slice(3, 5)).toEqual(["Jan_1-15", "Jan_16-31"]);
    expect(result.sheets[2].rows[0].slice(0, 5)).toEqual(["000001", "DELA CRUZ, JUAN A.", 2021, 75, 75]);
  });

  it("enforces allowed branches and selected clients before aggregating", () => {
    const result = buildPaymentExportData([employee], ledger, {
      scope: "branch", branchId: "branch-1", clientIds: ["client-2"], employeeId: "", employmentStatusIds: [EMPLOYMENT_STATUS.active], allowedBranchIds: ["branch-1"],
    }, ["PAYMENT_YEARLY"]);
    expect(result.paymentCount).toBe(2);
    expect(result.sheets[0].rows[0][2]).toBe(100);
  });

  it("includes any of the selected employee statuses", () => {
    const statusLedger = {
      ...ledger,
      payments: [...ledger.payments, { ...ledger.payments[0], id: "payment-6", employee_id: terminatedEmployee.id, amount_centavos: 2000 }],
    };
    const result = buildPaymentExportData([employee, terminatedEmployee], statusLedger, {
      scope: "all", branchId: "", clientIds: [], employeeId: "", employmentStatusIds: [EMPLOYMENT_STATUS.active, EMPLOYMENT_STATUS.terminated], allowedBranchIds: ["branch-1", "branch-2"],
    }, ["PAYMENT_YEARLY"]);
    expect(result.employeeCount).toBe(2);
  });

  it("adds another named range only when actual records contain a third distinct cut-off", () => {
    const extraLedger = {
      ...ledger,
      batches: [...ledger.batches, { ...ledger.batches[0], id: "batch-5", cutoff_from: "2021-01-20", cutoff_to: "2021-01-25" }],
      payments: [...ledger.payments, { ...ledger.payments[0], id: "payment-5", batch_id: "batch-5", amount_centavos: 3000 }],
    };
    const result = buildPaymentExportData([employee], extraLedger, {
      scope: "all", branchId: "", clientIds: [], employeeId: "", employmentStatusIds: [], allowedBranchIds: ["branch-1", "branch-2"],
    }, ["PAYMENT_PERIOD"]);
    expect(result.sheets[0].headers.slice(3, 6)).toEqual(["Jan_1-15", "Jan_16-31", "Jan_20-25"]);
    expect(result.sheets[0].rows[0].slice(3, 6)).toEqual([75, 75, 30]);
  });
});
