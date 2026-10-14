import type { PayrollData, PayrollInput, PayrollRecord } from "../../types/payroll";
import type { SpreadsheetRow } from "../imports/excelWorkbook";
import { pesosToCentavos } from "../payments/paymentMath";
import { buildEmployeeTerms, type TermsEmployee, type TermsFieldGroup } from "./employeeTermsBatch";
import { effectivePayrollRecord, validPayrollDate } from "./payrollSetup";
import { attendanceTime } from "./attendanceImport";

export const employeeTermsHeaders = ["EMPLOYEE ID", "EFFECTIVE DATE", "END DATE", "MODE", "WORKSITE ID", "RATE", "PAY BASIS", "MONTHLY METHOD", "MONTHLY FACTOR", "FREQUENCY", "PAYROLL GROUP", "SHIFT START", "SHIFT END", "BREAK MINUTES", "REST DAYS", "ALLOWANCES ACTION", "ALLOWANCE NAME", "ALLOWANCE AMOUNT", "ALLOWANCE BASIS", "ALLOWANCE TAX", "REASON"];
export type EmployeeTermsImportRow = { rowNumber: number; number: string; date: string; input: PayrollInput | null; error: string | null };

export function employeeTermsImportInput(row: SpreadsheetRow, employee: TermsEmployee, records: PayrollRecord[], site?: PayrollRecord): PayrollInput {
  if (!validPayrollDate(row["EFFECTIVE DATE"])) throw new Error("Enter a valid EFFECTIVE DATE.");
  const base = effectivePayrollRecord(records.filter((r) => r.kind === "employee_terms" && r.data.employee_id === employee.id), row["EFFECTIVE DATE"]);
  const mode = (row.MODE || "patch").toLowerCase();
  if (!["patch", "assign"].includes(mode)) throw new Error("MODE must be patch or assign.");
  const data: PayrollData = { label: "Pay terms", reason: row.REASON, effective_from: row["EFFECTIVE DATE"], effective_to: row["END DATE"] || null };
  const fields = new Set<TermsFieldGroup>();
  if (row.RATE) { data.rate_centavos = pesosToCentavos(row.RATE); fields.add("rate"); }
  if (row["PAY BASIS"] || row["MONTHLY METHOD"] || row["MONTHLY FACTOR"]) {
    Object.assign(data, { pay_basis: (row["PAY BASIS"] || base?.data.pay_basis)?.toLowerCase(), monthly_mode: (row["MONTHLY METHOD"] || base?.data.monthly_mode || "direct").toLowerCase(), monthly_factor: row["MONTHLY FACTOR"] ? Number(row["MONTHLY FACTOR"]) : base?.data.monthly_factor || null }); fields.add("basis");
  }
  if (row["WORKSITE ID"]) {
    if (!site || site.deleted_at || site.kind !== "worksite" || site.id !== row["WORKSITE ID"]) throw new Error("WORKSITE ID was not found.");
    data.worksite_id = site.id; data.worksite_label = site.data.label; fields.add("worksite");
  }
  if (row.FREQUENCY || row["PAYROLL GROUP"]) { Object.assign(data, { frequency: (row.FREQUENCY || base?.data.frequency)?.toLowerCase(), payroll_group: row["PAYROLL GROUP"] || base?.data.payroll_group }); fields.add("group"); }
  if (row["SHIFT START"] || row["SHIFT END"] || row["BREAK MINUTES"]) {
    if (mode === "patch" && base?.data.duty_segments) throw new Error("Edit split-duty schedules in the employee profile or bulk terms form; a legacy shift import cannot silently remove duty segments.");
    Object.assign(data, { shift_start: row["SHIFT START"] ? attendanceTime(row["SHIFT START"]) : base?.data.shift_start, shift_end: row["SHIFT END"] ? attendanceTime(row["SHIFT END"]) : base?.data.shift_end, break_minutes: row["BREAK MINUTES"] ? Number(row["BREAK MINUTES"]) : base?.data.break_minutes }); fields.add("schedule");
  }
  if (row["REST DAYS"]) {
    const text = row["REST DAYS"].toLowerCase();
    data.rest_days = text === "none" ? [] : text.split(",").map((d) => { const value = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"].indexOf(d.trim()); if (value < 0) throw new Error("REST DAYS must contain Sun, Mon, Tue, Wed, Thu, Fri, Sat, or none."); return value; }); fields.add("rest");
  }
  const action = (row["ALLOWANCES ACTION"] || "preserve").toLowerCase();
  if (!["preserve", "replace", "clear"].includes(action)) throw new Error("ALLOWANCES ACTION must be preserve, replace, or clear.");
  const hasAllowance = ["ALLOWANCE NAME", "ALLOWANCE AMOUNT", "ALLOWANCE BASIS", "ALLOWANCE TAX"].some((key) => row[key]);
  if (action !== "replace" && hasAllowance) throw new Error("Set ALLOWANCES ACTION to replace when entering an allowance.");
  if (action !== "preserve") {
    data.allowances = action === "clear" ? [] : [{ name: row["ALLOWANCE NAME"], amount_centavos: pesosToCentavos(row["ALLOWANCE AMOUNT"] || ""), basis: (row["ALLOWANCE BASIS"] || "worked_day").toLowerCase() as "worked_day", tax_treatment: (row["ALLOWANCE TAX"] || "unreviewed").toLowerCase() as "unreviewed" }]; fields.add("allowances");
  }
  if (mode === "assign") {
    if (!row["WORKSITE ID"] || !row.RATE || !row["PAY BASIS"] || !row.FREQUENCY || !row["PAYROLL GROUP"] || !row["SHIFT START"] || !row["SHIFT END"] || !row["BREAK MINUTES"] || !row["REST DAYS"]) throw new Error("Complete assignments require worksite, rate, pay basis, frequency, group, shift, break, and rest days.");
    data.allowances ??= [];
  }
  return buildEmployeeTerms(employee, records, data, mode === "assign" ? null : [...fields]);
}

export async function prepareEmployeeTermsImport(rows: SpreadsheetRow[], loadEmployee: (number: string) => Promise<TermsEmployee | null>, loadRecords: (id: string, date: string) => Promise<PayrollRecord[]>, sites: PayrollRecord[]): Promise<EmployeeTermsImportRow[]> {
  if (!rows.length || rows.length > 500) throw new Error("Import between 1 and 500 employee terms at a time.");
  const missing = ["EMPLOYEE ID", "EFFECTIVE DATE", "REASON"].filter((key) => !(key in rows[0]));
  if (missing.length) throw new Error(`Missing headers: ${missing.join(", ")}.`);
  const keys = rows.map((r) => r["EMPLOYEE ID"]?.trim().padStart(6, "0") || "");
  const counts = new Map<string, number>(); keys.forEach((key) => counts.set(key, (counts.get(key) || 0) + 1));
  const results: EmployeeTermsImportRow[] = [];
  let cursor = 0;
  async function worker() {
    while (cursor < rows.length) {
      const index = cursor++;
      const row = rows[index], number = row["EMPLOYEE ID"]?.trim().padStart(6, "0") || "", date = row["EFFECTIVE DATE"];
      let input: PayrollInput | null = null, error: string | null = null;
      try {
        if (!/^\d{6}$/.test(number)) throw new Error("Enter a valid EMPLOYEE ID.");
        if (counts.get(keys[index])! > 1) throw new Error("Duplicate employee in this workbook. Import one effective-dated change per employee at a time.");
        if (!validPayrollDate(date)) throw new Error("Enter a valid EFFECTIVE DATE.");
        const employee = await loadEmployee(number); if (!employee) throw new Error("Employee was not found.");
        const records = await loadRecords(employee.id, date);
        if (records.some((r) => !r.deleted_at && r.kind === "employee_terms" && r.data.employee_id === employee.id && r.data.effective_from === date)) throw new Error("Terms already exist for this effective date.");
        input = employeeTermsImportInput(row, employee, records, sites.find((s) => s.id === row["WORKSITE ID"]));
      } catch (reason) { error = (reason as Error).message; }
      results[index] = { rowNumber: index + 2, number, date, input, error };
    }
  }
  await Promise.all(Array.from({ length: Math.min(4, rows.length) }, worker));
  return results;
}

export async function downloadEmployeeTermsTemplate(sites: PayrollRecord[]) {
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook(), sheet = workbook.addWorksheet("EMPLOYEE TERMS", { views: [{ state: "frozen", ySplit: 1, xSplit: 2 }] });
  sheet.addRow(employeeTermsHeaders);
  employeeTermsHeaders.forEach((header, index) => { sheet.getColumn(index + 1).width = header === "REASON" ? 40 : 22; sheet.getColumn(index + 1).numFmt = "@"; });
  const lookup = workbook.addWorksheet("WORKSITES"); lookup.addRow(["WORKSITE ID", "WORKSITE", "REGION", "BRANCH ID", "CLIENT ID"]);
  sites.forEach((s) => lookup.addRow([s.id, s.data.label, s.data.region, s.data.branch_id, s.data.client_id || "Agency"])); lookup.columns.forEach((c) => { c.width = 40; });
  const notes = workbook.addWorksheet("REFERENCE"); notes.addRows([["MODE", "patch preserves blank fields; assign requires complete terms."], ["REST DAYS", "Sun,Tue; use none to remove all rest days. Blank preserves existing days in patch mode."], ["ALLOWANCES ACTION", "preserve (default), replace (one allowance), or clear. Profile supports multiple allowances."], ["PAY BASIS", "daily or monthly"], ["MONTHLY METHOD", "direct or daily_factor"], ["FREQUENCY", "weekly, semi_monthly, or monthly"], ["ALLOWANCE BASIS", "worked_day, cutoff, or month"], ["ALLOWANCE TAX", "unreviewed, taxable, or non_taxable"], ["EMPLOYEE ID", "Exact six-digit employee number. Dates use YYYY-MM-DD. Amounts use pesos."], ["END DATE", "Optional expiry for the new version; does not revive an older version."], ["IMPORT", "All rows must pass validation before the atomic save. Existing versions cannot be overwritten."]]); notes.getColumn(1).width = 26; notes.getColumn(2).width = 105;
  const bytes = await workbook.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = "employee-payroll-terms.xlsx"; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
