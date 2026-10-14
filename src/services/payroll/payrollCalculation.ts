import type { CalculationRule, CalculationRuleInput, CalculationSource, CalculationDay, CalculationEmployee } from "../../types/payrollCalculation";
import type { PayrollRun } from "../../types/payrollRun";
import type { PayrollRecord } from "../../types/payroll";
import type { AttendanceTeamRow } from "./attendanceTeam";
import { attendanceMetrics, segmentRange, validateAttendanceInput } from "./attendanceCore";
import { cooperativeDeductionForDate, resolvePayrollWorkDate, validPayrollDate, validatePayrollInput } from "./payrollSetup";
import { buildRunCoverage, runDates, validateRunPagination } from "./payrollRuns";
export const calculationRulesKey = "coop_sys_payroll_calculation_rules";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function validateCalculationRule(r: CalculationRuleInput) {
  if (!["policy", "calendar"].includes(r.kind) || !uuid.test(r.worksite_id) || !validPayrollDate(r.effective_from)) throw new Error("Select a rule type, worksite and valid date.");
  if (typeof r.reviewed !== "boolean" || typeof r.reference !== "string" || !r.reference.trim() || r.reference.length > 1000) throw new Error("A review state and reference are required.");
  if (r.kind === "policy") {
    if (!r.payroll_group?.trim() || r.payroll_group.length > 200 || !Number.isInteger(r.regular_minutes) || Number(r.regular_minutes) < 1 || Number(r.regular_minutes) > 1440 || !["block", "proportional"].includes(r.short_day || "") || !["full", "proportional"].includes(r.worked_allowance || "")) throw new Error("Set the group, regular minutes, short-day and worked-day allowance policies.");
  } else if (r.payroll_group !== "" || !["ordinary", "regular_holiday", "special_non_working", "special_working", "suspended"].includes(r.day_type || "")) throw new Error("Calendar classifications apply to the worksite, not a payroll group.");
}
export function validateCalculationRecords(records: CalculationRule[]) {
  const ids = new Set<string>();
  for (const r of records) {
    validateCalculationRule(r);
    if (!uuid.test(r.id) || ids.has(r.id) || !uuid.test(r.created_by) || !Number.isFinite(Date.parse(r.created_at))) throw new Error("Invalid calculation rule history.");
    ids.add(r.id);
  }
}
export function currentCalculationRule(records: CalculationRule[], date: string, kind: "policy" | "calendar", group: string) {
  return records.filter((r) => r.kind === kind && (kind === "calendar" ? r.effective_from === date : r.effective_from <= date && r.payroll_group.trim().toLowerCase() === group.trim().toLowerCase()))
    .sort((a, b) => b.effective_from.localeCompare(a.effective_from) || b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id))[0] || null;
}
function roundedRatio(amount: number, numerator: number, denominator: number) {
  if (![amount, numerator, denominator].every(Number.isSafeInteger) || amount < 0 || numerator < 0 || denominator < 1) throw new Error("Invalid calculation amounts or minute precision.");
  const n = BigInt(amount) * BigInt(numerator), d = BigInt(denominator), value = Number((n * 2n + d) / (d * 2n));
  if (!Number.isSafeInteger(value)) throw new Error("Calculation exceeds supported precision.");
  return value;
}
export function buildCalculationSource(run: PayrollRun, rows: AttendanceTeamRow[], setup: PayrollRecord[], rules: CalculationRule[], members: Record<string, boolean>, limit: number, offset: number, search = ""): CalculationSource {
  const coverage = buildRunCoverage(run, rows, limit, offset, search), selected = new Set(coverage.items.map((r) => r.employeeId));
  const site = setup.find((r) => r.id === run.worksite_id), applicable = rules.filter((r) => r.worksite_id === run.worksite_id), used = new Set<string>();
  for (const date of runDates(run)) for (const kind of ["policy", "calendar"] as const) { const rule = currentCalculationRule(applicable, date, kind, run.payroll_group); if (rule) used.add(rule.id); }
  return { run, total: coverage.total, rows: rows.filter((r) => selected.has(r.employeeId)), setup: setup.filter((r) => !r.deleted_at && (r.id === run.worksite_id || r.kind === "cooperative_policy" || r.kind === "wage" && r.data.series === site?.data.wage_series || r.data.employee_id && selected.has(r.data.employee_id))), rules: applicable.filter((r) => used.has(r.id)), members: Object.fromEntries([...selected].map((id) => [id, Boolean(members[id])])) };
}
export function calculateDraftPage(source: CalculationSource): CalculationEmployee[] {
  if (source.run.status !== "draft") throw new Error("Cancelled runs cannot be calculated.");
  const records = new Map<string, CalculationEmployee>();
  const seen = new Set<string>();
  for (const row of source.rows) {
    if (row.date < source.run.period_start || row.date > source.run.period_end || seen.has(`${row.employeeId}:${row.date}`)) throw new Error("Calculation source contains an invalid or duplicate assignment-day.");
    seen.add(`${row.employeeId}:${row.date}`);
    const candidate = row.terms || row.baseTerms;
    if (!candidate || candidate.data.worksite_id !== source.run.worksite_id || candidate.data.frequency !== source.run.frequency || candidate.data.payroll_group?.trim().toLowerCase() !== source.run.payroll_group.trim().toLowerCase()) continue;
    const rules = source.rules.filter((r) => r.worksite_id === source.run.worksite_id);
    const policy = currentCalculationRule(rules, row.date, "policy", source.run.payroll_group), calendar = currentCalculationRule(rules, row.date, "calendar", "");
    const attendance = row.attendance, terms = row.terms;
    const day: CalculationDay = { date: row.date, attendanceId: attendance?.id || null, termsId: terms?.id || null, policyId: policy?.id || null, calendarId: calendar?.id || null, rateCentavos: terms?.data.rate_centavos ?? null, workedMinutes: 0, regularMinutes: policy?.regular_minutes ?? null, baseCentavos: null, allowanceCentavos: null, issues: [] };
    const issues = day.issues;
    if (!policy?.reviewed) issues.push("Missing / unreviewed calculation policy");
    if (!calendar?.reviewed) issues.push("Missing / unreviewed day classification");
    else if (calendar.day_type !== "ordinary") issues.push("Holiday / special-day rules are not implemented");
    if (!terms) issues.push("Missing / expired pay terms");
    if (!attendance || attendance.review_status !== "approved") issues.push("Attendance must be approved");
    if (attendance && (attendance.employee_id !== row.employeeId || attendance.work_date !== row.date)) issues.push("Attendance does not match the assignment-day");
    if (terms && attendance && attendance.terms_id !== terms.id) issues.push("Pay terms changed after attendance entry");
    if (terms) {
      try { validatePayrollInput(terms); } catch (error) { issues.push((error as Error).message); }
      if (terms.data.pay_basis !== "daily") issues.push("Monthly conversion / proration is not implemented");
      const resolution = resolvePayrollWorkDate(source.setup, row.employeeId, row.date);
      if (resolution.terms?.id !== terms.id) issues.push("Dated pay terms are inconsistent");
      issues.push(...resolution.issues);
      if (terms.data.allowances?.some((a) => a.basis !== "worked_day")) issues.push("Cutoff / monthly allowance allocation is not implemented");
    }
    if (attendance && terms && policy) try {
      validateCalculationRule(policy); if (calendar) validateCalculationRule(calendar); validateAttendanceInput(attendance);
      const metrics = attendanceMetrics(attendance, terms.data); day.workedMinutes = metrics.worked;
      if (metrics.scheduled !== policy.regular_minutes) issues.push("Scheduled regular minutes differ from the reviewed policy");
      const actualRestDay = terms.data.rest_days?.includes(new Date(`${row.date}T00:00:00Z`).getUTCDay());
      if (attendance.status === "paid_leave") issues.push("Paid-leave entitlement is not implemented");
      if (attendance.status === "rest_day" && !actualRestDay) issues.push("Rest-day record does not match the dated schedule");
      if (attendance.status === "present") {
        if (actualRestDay) issues.push("Rest-day work premiums are not implemented");
        const scheduledStart = Number(terms.data.shift_start!.slice(0, 2)) * 60 + Number(terms.data.shift_start!.slice(3)), scheduledEnd = scheduledStart + metrics.scheduled + terms.data.break_minutes!;
        if (attendance.segments.some((s) => { const r = segmentRange(s); return r.start < scheduledStart || r.end > scheduledEnd; }) || metrics.worked > policy.regular_minutes!) issues.push("Outside-shift / overtime allocation is not implemented");
        if (attendance.segments.some((s) => { const r = segmentRange(s); return r.start < 360 || r.end > 1320; })) issues.push("Night / overnight pay rules are not implemented");
        if (metrics.worked < policy.regular_minutes! && policy.short_day === "block") issues.push("Short-day pay requires a reviewed proportional policy");
      }
      if (!issues.length) {
        const payable = attendance.status === "present";
        day.baseCentavos = payable ? roundedRatio(terms.data.rate_centavos!, metrics.worked, policy.regular_minutes!) : 0;
        day.allowanceCentavos = payable ? (terms.data.allowances || []).reduce((sum, a) => sum + (policy.worked_allowance === "full" ? a.amount_centavos : roundedRatio(a.amount_centavos, metrics.worked, policy.regular_minutes!)), 0) : 0;
      }
    } catch (error) { issues.push((error as Error).message); }
    const record = records.get(row.employeeId) || { employeeId: row.employeeId, employeeLabel: row.employeeLabel, baseCentavos: null, allowanceCentavos: null, subtotalCentavos: null, cooperativePlanCentavos: null, cooperativeSource: null, days: [], issues: [] };
    record.days.push(day); records.set(row.employeeId, record);
  }
  for (const employee of records.values()) {
    employee.days.sort((a, b) => a.date.localeCompare(b.date));
    employee.issues = [...new Set(employee.days.flatMap((d) => d.issues))];
    if (!employee.issues.length) {
      employee.baseCentavos = employee.days.reduce((sum, d) => sum + d.baseCentavos!, 0);
      employee.allowanceCentavos = employee.days.reduce((sum, d) => sum + d.allowanceCentavos!, 0);
      employee.subtotalCentavos = employee.baseCentavos + employee.allowanceCentavos;
      if (!Number.isSafeInteger(employee.subtotalCentavos)) throw new Error("Payroll subtotal exceeds supported precision.");
    }
    if (source.members[employee.employeeId]) {
      const contribution = cooperativeDeductionForDate(source.setup, employee.employeeId, source.run.period_end);
      employee.cooperativePlanCentavos = contribution.amountCentavos; employee.cooperativeSource = contribution.source;
    }
  }
  return [...records.values()].sort((a, b) => a.employeeLabel.localeCompare(b.employeeLabel) || a.employeeId.localeCompare(b.employeeId));
}
export function rulePage(records: CalculationRule[], kind: "policy" | "calendar", site: string, limit: number, offset: number) {
  validateRunPagination(limit, offset);
  const all = records.filter((r) => r.kind === kind && r.worksite_id === site).sort((a, b) => b.effective_from.localeCompare(a.effective_from) || b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id));
  return { items: all.slice(offset, offset + limit), total: all.length };
}
