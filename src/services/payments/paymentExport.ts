import type { Employee } from "../../types/employee";
import type { MemberPayment, PaymentBatch, PaymentLedger } from "../../types/payment";
import { employmentStatuses, labelFor } from "../../features/employees/data/employeeOptions";

export const PAYMENT_EXPORT_SHEETS = ["PAYMENT_YEARLY", "PAYMENT_MONTHLY", "PAYMENT_PERIOD"] as const;
export type PaymentExportSheetName = (typeof PAYMENT_EXPORT_SHEETS)[number];
export type PaymentExportScope = "all" | "branch" | "employee";

export type PaymentExportFilters = {
  scope: PaymentExportScope;
  branchId: string;
  clientIds: string[];
  employeeId: string;
  employmentStatusIds: string[];
  allowedBranchIds: string[];
};

export type PaymentExportSheet = {
  name: PaymentExportSheetName;
  headers: Array<string | number>;
  rows: Array<Array<string | number | null>>;
  freezeColumns: number;
  comments?: Array<{ rowIndex: number; columnIndex: number; text: string }>;
};

export type PaymentExportData = {
  sheets: PaymentExportSheet[];
  paymentCount: number;
  employeeCount: number;
  firstYear: number;
  lastYear: number;
};

const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"] as const;

function fullName(employee: Employee) {
  const middleInitial = employee.middle_name?.trim() ? ` ${employee.middle_name.trim().charAt(0)}.` : "";
  const suffix = employee.suffix?.trim() ? ` ${employee.suffix.trim()}` : "";
  return `${employee.last_name}, ${employee.first_name}${middleInitial}${suffix}`.toUpperCase();
}

function yearOf(date: string) {
  return Number(date.slice(0, 4));
}

function monthOf(date: string) {
  return Number(date.slice(5, 7)) - 1;
}

function paymentCutoff(payment: MemberPayment, batch: PaymentBatch | undefined) {
  const from = batch?.cutoff_from ?? batch?.cutoff_to ?? payment.payment_date;
  const to = batch?.cutoff_to ?? batch?.cutoff_from ?? payment.payment_date;
  const fromMonth = monthOf(from);
  const toMonth = monthOf(to);
  const fromDay = Number(from.slice(8, 10));
  const toDay = Number(to.slice(8, 10));
  const label = fromMonth === toMonth
    ? `${months[fromMonth][0]}${months[fromMonth].slice(1).toLowerCase()}_${fromDay}-${toDay}`
    : `${months[fromMonth][0]}${months[fromMonth].slice(1).toLowerCase()}_${fromDay}-${months[toMonth][0]}${months[toMonth].slice(1).toLowerCase()}_${toDay}`;
  return {
    key: `${String(fromMonth + 1).padStart(2, "0")}-${String(fromDay).padStart(2, "0")}|${String(toMonth + 1).padStart(2, "0")}-${String(toDay).padStart(2, "0")}`,
    from, to, year: yearOf(from), fromMonth, toMonth, fromDay, toDay, label,
  };
}

function pesos(centavos: number) {
  return centavos / 100;
}

function refundComment(refunds: PaymentLedger["refunds"]) {
  return refunds.map((refund, index) => {
    const cutoff = refund.cutoff_from && refund.cutoff_to ? `${refund.cutoff_from} to ${refund.cutoff_to}` : "Date only";
    return `${index + 1}. Cut-off: ${cutoff}; Refunded: ${refund.refund_date}; Amount: ${pesos(refund.amount_centavos).toFixed(2)}; Remarks: ${refund.remarks?.trim() || "None"}`;
  }).join("\n");
}

function settlementFields(employeeId: string, ledger: PaymentLedger) {
  const settlement = ledger.settlements
    .filter((item) => item.employee_id === employeeId)
    .sort((a, b) => b.settlement_date.localeCompare(a.settlement_date))[0];
  return {
    remarks: settlement ? settlement.remarks?.trim() || "CLAIMED" : null,
    date: settlement?.settlement_date ?? null,
  };
}

export function buildPaymentExportData(
  employees: Employee[],
  ledger: PaymentLedger,
  filters: PaymentExportFilters,
  includedSheets: PaymentExportSheetName[],
): PaymentExportData {
  if (filters.scope === "employee" && filters.clientIds.length !== 1) throw new Error("Select one specific client before exporting an employee.");
  const allowedBranches = new Set(filters.allowedBranchIds);
  const selectedClients = new Set(filters.clientIds);
  const selectedStatuses = new Set(filters.employmentStatusIds);
  const employeesById = new Map(employees.map((employee) => [employee.id, employee]));
  const batchesById = new Map(ledger.batches.map((batch) => [batch.id, batch]));
  const eligibleEmployeeIds = new Set(
    employees
      .filter((employee) => filters.scope === "employee" || !selectedStatuses.size || Boolean(employee.employment_status_id && selectedStatuses.has(employee.employment_status_id)))
      .filter((employee) => filters.scope !== "employee" || employee.id === filters.employeeId)
      .map((employee) => employee.id),
  );

  const payments = ledger.payments.filter((payment) => {
    const batch = batchesById.get(payment.batch_id);
    if (!batch || !employeesById.has(payment.employee_id) || !eligibleEmployeeIds.has(payment.employee_id)) return false;
    if (!allowedBranches.has(batch.branch_id)) return false;
    if (filters.scope === "branch" && batch.branch_id !== filters.branchId) return false;
    if (selectedClients.size && (!batch.client_id || !selectedClients.has(batch.client_id))) return false;
    return true;
  });
  const refunds = (ledger.refunds ?? []).filter((refund) => {
    if (!employeesById.has(refund.employee_id) || !eligibleEmployeeIds.has(refund.employee_id)) return false;
    if (!allowedBranches.has(refund.branch_id)) return false;
    if (filters.scope === "branch" && refund.branch_id !== filters.branchId) return false;
    if (selectedClients.size && (!refund.client_id || !selectedClients.has(refund.client_id))) return false;
    return true;
  });

  if (!payments.length) throw new Error("No payment records match the selected export filters.");

  const actualYears = payments.map((payment) => yearOf(payment.payment_date));
  const firstYear = Math.min(...actualYears);
  const lastYear = Math.max(...actualYears);
  const years = Array.from({ length: lastYear - firstYear + 1 }, (_, index) => firstYear + index);
  const exportedEmployees = employees
    .filter((employee) => payments.some((payment) => payment.employee_id === employee.id))
    .sort((a, b) => a.last_name.localeCompare(b.last_name) || a.first_name.localeCompare(b.first_name));
  const requested = new Set(includedSheets);
  const sheets: PaymentExportSheet[] = [];

  if (requested.has("PAYMENT_YEARLY")) {
    const headers: Array<string | number> = ["ID", "NAME", ...years, "REFUND", "STATUS", "REMARKS", "DATE"];
    const comments: NonNullable<PaymentExportSheet["comments"]> = [];
    const rows = exportedEmployees.map((employee, rowIndex) => {
      const employeePayments = payments.filter((payment) => payment.employee_id === employee.id);
      const employeeRefunds = refunds.filter((refund) => refund.employee_id === employee.id);
      const settlement = settlementFields(employee.id, ledger);
      years.forEach((year, index) => { const matching = employeeRefunds.filter((refund) => yearOf(refund.refund_date) === year); if (matching.length) comments.push({ rowIndex, columnIndex: index + 2, text: refundComment(matching) }); });
      if (employeeRefunds.length) comments.push({ rowIndex, columnIndex: years.length + 2, text: refundComment(employeeRefunds) });
      return [
        employee.employee_number,
        fullName(employee),
        ...years.map((year) => pesos(employeePayments.filter((payment) => yearOf(payment.payment_date) === year).reduce((sum, payment) => sum + payment.amount_centavos, 0)) || null),
        pesos(employeeRefunds.reduce((sum, refund) => sum + refund.amount_centavos, 0)) || null,
        labelFor(employmentStatuses, employee.employment_status_id).toUpperCase(),
        settlement.remarks,
        settlement.date,
      ];
    });
    sheets.push({ name: "PAYMENT_YEARLY", headers, rows, freezeColumns: 2, comments });
  }

  if (requested.has("PAYMENT_MONTHLY")) {
    const headers = ["ID", "NAME", "YEAR", ...months, "REFUND", "STATUS", "REMARKS", "DATE"];
    const comments: NonNullable<PaymentExportSheet["comments"]> = [];
    let rowIndex = 0;
    const rows = exportedEmployees.flatMap((employee) => {
      const employeePayments = payments.filter((payment) => payment.employee_id === employee.id);
      const employeeYears = [...new Set(employeePayments.map((payment) => yearOf(payment.payment_date)))].sort();
      const settlement = settlementFields(employee.id, ledger);
      return employeeYears.map((year) => {
        const yearRefunds = refunds.filter((refund) => refund.employee_id === employee.id && yearOf(refund.refund_date) === year);
        months.forEach((_, month) => { const matching = yearRefunds.filter((refund) => monthOf(refund.refund_date) === month); if (matching.length) comments.push({ rowIndex, columnIndex: month + 3, text: refundComment(matching) }); });
        if (yearRefunds.length) comments.push({ rowIndex, columnIndex: 15, text: refundComment(yearRefunds) });
        const row = [
        employee.employee_number,
        fullName(employee),
        year,
        ...months.map((_, month) => pesos(employeePayments.filter((payment) => yearOf(payment.payment_date) === year && monthOf(payment.payment_date) === month).reduce((sum, payment) => sum + payment.amount_centavos, 0)) || null),
        pesos(yearRefunds.reduce((sum, refund) => sum + refund.amount_centavos, 0)) || null,
        labelFor(employmentStatuses, employee.employment_status_id).toUpperCase(),
        settlement.remarks,
        settlement.date,
        ];
        rowIndex += 1;
        return row;
      });
    });
    sheets.push({ name: "PAYMENT_MONTHLY", headers, rows, freezeColumns: 2, comments });
  }

  if (requested.has("PAYMENT_PERIOD")) {
    const cutoffDefinitions = new Map<string, ReturnType<typeof paymentCutoff>>();
    payments.forEach((payment) => {
      const cutoff = paymentCutoff(payment, batchesById.get(payment.batch_id));
      if (!cutoffDefinitions.has(cutoff.key)) cutoffDefinitions.set(cutoff.key, cutoff);
    });
    const periods = [...cutoffDefinitions.values()].sort((a, b) => a.fromMonth - b.fromMonth || a.fromDay - b.fromDay || a.toMonth - b.toMonth || a.toDay - b.toDay);
    const periodHeaders = periods.map((period) => period.label);
    const headers = ["ID", "NAME", "YEAR", ...periodHeaders, "REFUND", "STATUS", "REMARKS", "DATE"];
    const comments: NonNullable<PaymentExportSheet["comments"]> = [];
    let rowIndex = 0;
    const rows = exportedEmployees.flatMap((employee) => {
      const employeePayments = payments.filter((payment) => payment.employee_id === employee.id);
      const employeeYears = [...new Set(employeePayments.map((payment) => paymentCutoff(payment, batchesById.get(payment.batch_id)).year))].sort();
      const settlement = settlementFields(employee.id, ledger);
      return employeeYears.map((year) => {
        const yearRefunds = refunds.filter((refund) => refund.employee_id === employee.id && yearOf(refund.refund_date) === year);
        periods.forEach((period, index) => { const matching = yearRefunds.filter((refund) => refund.cutoff_from === period.from && refund.cutoff_to === period.to); if (matching.length) comments.push({ rowIndex, columnIndex: index + 3, text: refundComment(matching) }); });
        if (yearRefunds.length) comments.push({ rowIndex, columnIndex: periods.length + 3, text: refundComment(yearRefunds) });
        const row = [
        employee.employee_number,
        fullName(employee),
        year,
        ...periods.map((period) => {
          return pesos(employeePayments.filter((payment) => {
            const cutoff = paymentCutoff(payment, batchesById.get(payment.batch_id));
            return cutoff.year === year && cutoff.key === period.key;
          }).reduce((sum, payment) => sum + payment.amount_centavos, 0)) || null;
        }),
        pesos(yearRefunds.reduce((sum, refund) => sum + refund.amount_centavos, 0)) || null,
        labelFor(employmentStatuses, employee.employment_status_id).toUpperCase(),
        settlement.remarks,
        settlement.date,
        ];
        rowIndex += 1;
        return row;
      });
    });
    sheets.push({ name: "PAYMENT_PERIOD", headers, rows, freezeColumns: 2, comments });
  }

  return { sheets, paymentCount: payments.length, employeeCount: exportedEmployees.length, firstYear, lastYear };
}
