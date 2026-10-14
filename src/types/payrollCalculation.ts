import type { PayrollRecord } from "./payroll";
import type { PayrollRun } from "./payrollRun";
import type { AttendanceTeamRow } from "../services/payroll/attendanceTeam";
export type CalculationRuleInput = { kind: "policy" | "calendar"; worksite_id: string; effective_from: string; payroll_group: string; reviewed: boolean; reference: string; regular_minutes?: number; short_day?: "block" | "proportional"; worked_allowance?: "full" | "proportional"; day_type?: "ordinary" | "regular_holiday" | "special_non_working" | "special_working" | "suspended" };
export type CalculationRule = CalculationRuleInput & { id: string; created_at: string; created_by: string };
export type CalculationRuleQuery = { worksiteId: string; kind: CalculationRuleInput["kind"]; limit?: number; offset?: number };
export type CalculationSource = { run: PayrollRun; rows: AttendanceTeamRow[]; setup: PayrollRecord[]; rules: CalculationRule[]; members: Record<string, boolean>; total: number };
export type CalculationDay = { date: string; attendanceId: string | null; termsId: string | null; policyId: string | null; calendarId: string | null; rateCentavos: number | null; workedMinutes: number; regularMinutes: number | null; baseCentavos: number | null; allowanceCentavos: number | null; issues: string[] };
export type CalculationEmployee = { employeeId: string; employeeLabel: string; baseCentavos: number | null; allowanceCentavos: number | null; subtotalCentavos: number | null; cooperativePlanCentavos: number | null; cooperativeSource: string | null; days: CalculationDay[]; issues: string[] };
