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
  employmentStatusId: string;
  allowedBranchIds: string[];
};

export type PaymentExportSheet = {
  name: PaymentExportSheetName;
  headers: Array<string | number>;
  rows: Array<Array<string | number | null>>;
  freezeColumns: number;
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
  const allowedBranches = new Set(filters.allowedBranchIds);
  const selectedClients = new Set(filters.clientIds);
  const employeesById = new Map(employees.map((employee) => [employee.id, employee]));
  const batchesById = new Map(ledger.batches.map((batch) => [batch.id, batch]));
  const eligibleEmployeeIds = new Set(
    employees
      .filter((employee) => !filters.employmentStatusId || employee.employment_status_id === filters.employmentStatusId)
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
    const headers: Array<string | number> = ["ID", "NAME", ...years, "STATUS", "REMARKS", "DATE"];
    const rows = exportedEmployees.map((employee) => {
      const employeePayments = payments.filter((payment) => payment.employee_id === employee.id);
      const settlement = settlementFields(employee.id, ledger);
      return [
        employee.employee_number,
        fullName(employee),
        ...years.map((year) => pesos(employeePayments.filter((payment) => yearOf(payment.payment_date) === year).reduce((sum, payment) => sum + payment.amount_centavos, 0)) || null),
        labelFor(employmentStatuses, employee.employment_status_id).toUpperCase(),
        settlement.remarks,
        settlement.date,
      ];
    });
    sheets.push({ name: "PAYMENT_YEARLY", headers, rows, freezeColumns: 2 });
  }

  if (requested.has("PAYMENT_MONTHLY")) {
    const headers = ["ID", "NAME", "YEAR", ...months, "STATUS", "REMARKS", "DATE"];
    const rows = exportedEmployees.flatMap((employee) => {
      const employeePayments = payments.filter((payment) => payment.employee_id === employee.id);
      const employeeYears = [...new Set(employeePayments.map((payment) => yearOf(payment.payment_date)))].sort();
      const settlement = settlementFields(employee.id, ledger);
      return employeeYears.map((year) => [
        employee.employee_number,
        fullName(employee),
        year,
        ...months.map((_, month) => pesos(employeePayments.filter((payment) => yearOf(payment.payment_date) === year && monthOf(payment.payment_date) === month).reduce((sum, payment) => sum + payment.amount_centavos, 0)) || null),
        labelFor(employmentStatuses, employee.employment_status_id).toUpperCase(),
        settlement.remarks,
        settlement.date,
      ]);
    });
    sheets.push({ name: "PAYMENT_MONTHLY", headers, rows, freezeColumns: 2 });
  }

  if (requested.has("PAYMENT_PERIOD")) {
    const cutoffDefinitions = new Map<string, ReturnType<typeof paymentCutoff>>();
    payments.forEach((payment) => {
      const cutoff = paymentCutoff(payment, batchesById.get(payment.batch_id));
      if (!cutoffDefinitions.has(cutoff.key)) cutoffDefinitions.set(cutoff.key, cutoff);
    });
    const periods = [...cutoffDefinitions.values()].sort((a, b) => a.fromMonth - b.fromMonth || a.fromDay - b.fromDay || a.toMonth - b.toMonth || a.toDay - b.toDay);
    const periodHeaders = periods.map((period) => period.label);
    const headers = ["ID", "NAME", "YEAR", ...periodHeaders, "STATUS", "REMARKS", "DATE"];
    const rows = exportedEmployees.flatMap((employee) => {
      const employeePayments = payments.filter((payment) => payment.employee_id === employee.id);
      const employeeYears = [...new Set(employeePayments.map((payment) => paymentCutoff(payment, batchesById.get(payment.batch_id)).year))].sort();
      const settlement = settlementFields(employee.id, ledger);
      return employeeYears.map((year) => [
        employee.employee_number,
        fullName(employee),
        year,
        ...periods.map((period) => {
          return pesos(employeePayments.filter((payment) => {
            const cutoff = paymentCutoff(payment, batchesById.get(payment.batch_id));
            return cutoff.year === year && cutoff.key === period.key;
          }).reduce((sum, payment) => sum + payment.amount_centavos, 0)) || null;
        }),
        labelFor(employmentStatuses, employee.employment_status_id).toUpperCase(),
        settlement.remarks,
        settlement.date,
      ]);
    });
    sheets.push({ name: "PAYMENT_PERIOD", headers, rows, freezeColumns: 2 });
  }

  return { sheets, paymentCount: payments.length, employeeCount: exportedEmployees.length, firstYear, lastYear };
}
