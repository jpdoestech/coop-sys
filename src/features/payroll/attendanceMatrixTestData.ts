import type { AttendanceRecord } from "../../types/attendance";
import type { PayrollRecord } from "../../types/payroll";
import type { PayrollRun } from "../../types/payrollRun";
import type { CalculationSource } from "../../types/payrollCalculation";
import { runDates } from "../../services/payroll/payrollRuns";

const id = (n: number) => `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
export const matrixTestRun: PayrollRun = { id: id(9), title: "October QA cutoff", worksite_id: id(8), worksite_label: "QA Factory", payroll_group: "A", frequency: "semi_monthly", period_start: "2026-10-01", period_end: "2026-10-15", pay_date: "2026-10-20", reason: "QA", status: "draft", created_by: id(7), created_at: "2026-10-01T00:00:00Z", updated_at: "2026-10-01T00:00:00Z", cancelled_by: null, cancelled_at: null, cancel_reason: null };
export function matrixTestSource(run = matrixTestRun, count = 2): CalculationSource {
  const rows = Array.from({ length: count }, (_, i) => {
    const terms: PayrollRecord = { id: id(100 + i), kind: "employee_terms", created_by: id(7), created_at: run.created_at, updated_at: run.created_at, deleted_at: null, data: { label: "QA terms", reason: "QA", employee_id: id(i + 1), worksite_id: run.worksite_id, effective_from: "2025-01-01", pay_basis: "daily", rate_centavos: 60000, frequency: run.frequency, payroll_group: run.payroll_group, shift_start: "08:00", shift_end: "17:00", break_minutes: 60, rest_days: [0], allowances: [], duty_segments: [{ time_in: "08:00", time_out: "12:00", in_next_day: false, out_next_day: false, break_minutes: 0 }, { time_in: "13:00", time_out: "17:00", in_next_day: false, out_next_day: false, break_minutes: 0 }] } };
    return runDates(run).map((date) => ({ employeeId: id(i + 1), employeeLabel: `${String(i + 1).padStart(6, "0")} - QA, Employee ${i + 1}`, date, terms, baseTerms: terms, attendance: null as AttendanceRecord | null, neighbors: [], restDay: new Date(date).getUTCDay() === 0 }));
  }).flat();
  return { run, rows, total: count, rules: [], setup: [], members: {} };
}
