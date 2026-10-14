export type HolidayKind = "ordinary" | "special_working" | "special_non_working" | "regular_holiday" | "double_regular_holiday";
export type DailyAttendanceState = "present" | "paid_leave" | "absent" | "unpaid_leave" | "rest_day" | "awol";
export type WageDayEvidence = {
  employeeId: string;
  clientId: string;
  date: string;
  calendarReviewed: boolean;
  holiday: HolidayKind;
  restDay: boolean;
  scheduledWorkday: boolean;
  attendance: { status: DailyAttendanceState; approved: boolean; workedMinutes: number } | null;
};
export type ResolvedWorkday = "ordinary" | "rest_day" | "special_non_working" | "special_non_working_rest_day" | "regular_holiday" | "regular_holiday_rest_day" | "double_regular_holiday" | "double_regular_holiday_rest_day";
export type HolidayEligibility = {
  status: "eligible" | "ineligible" | "needs_review";
  evidenceDate: string | null;
  reason: string;
};
export type DailyWageMatrix = Record<ResolvedWorkday, number>;
export type StatutoryDailyWageRules = {
  id: string;
  effectiveFrom: string;
  effectiveTo?: string | null;
  reviewed: boolean;
  reference: string;
  standardMinutes: number;
  minimumWorkedBasisPoints: DailyWageMatrix;
  minimumUnworkedBasisPoints: DailyWageMatrix;
};
export type ClientDailyWagePolicy = {
  id: string;
  clientId: string;
  statutoryRuleId: string;
  effectiveFrom: string;
  effectiveTo?: string | null;
  reviewed: boolean;
  reference: string;
  regularMinutes: number;
  workedBasisPoints: DailyWageMatrix;
  unworkedBasisPoints: DailyWageMatrix;
  requirePrecedingAttendance: boolean;
};
export type DailyWageInput = {
  payBasis: "daily" | "monthly";
  basicDailyCentavos: number;
  statutoryCoverageConfirmed: boolean;
  policy: ClientDailyWagePolicy;
  statutoryRules: StatutoryDailyWageRules;
  day: WageDayEvidence;
  history: WageDayEvidence[];
  specialUnworkedBenefit?: { amountCentavos: number; reviewed: boolean; reference: string };
};
export type DailyWageResult = {
  status: "calculated" | "needs_review";
  dayType: ResolvedWorkday;
  payCentavos: number | null;
  appliedBasisPoints: number | null;
  eligibility: HolidayEligibility | null;
  reason: string;
  policyId: string;
  statutoryRuleId: string;
};

const holidays: HolidayKind[] = ["ordinary", "special_working", "special_non_working", "regular_holiday", "double_regular_holiday"];
const states: DailyAttendanceState[] = ["present", "paid_leave", "absent", "unpaid_leave", "rest_day", "awol"];
const workdayTypes: ResolvedWorkday[] = ["ordinary", "rest_day", "special_non_working", "special_non_working_rest_day", "regular_holiday", "regular_holiday_rest_day", "double_regular_holiday", "double_regular_holiday_rest_day"];

function validDate(date: string) {
  return typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(`${date}T00:00:00Z`)) && new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) === date;
}
function previousDate(date: string) {
  return new Date(Date.parse(`${date}T00:00:00Z`) - 86400000).toISOString().slice(0, 10);
}
function validateDay(day: WageDayEvidence) {
  if (!day || typeof day.employeeId !== "string" || !day.employeeId.trim() || typeof day.clientId !== "string" || !day.clientId.trim() || !validDate(day.date) || !holidays.includes(day.holiday)) throw new Error("Invalid employee, client, date or holiday classification.");
  if ([day.calendarReviewed, day.restDay, day.scheduledWorkday].some((v) => typeof v !== "boolean") || day.restDay && day.scheduledWorkday) throw new Error("Invalid dated calendar or rest-day schedule.");
  const attendance = day.attendance;
  if (attendance && (!states.includes(attendance.status) || typeof attendance.approved !== "boolean" || !Number.isInteger(attendance.workedMinutes) || attendance.workedMinutes < 0 || attendance.workedMinutes > 1440 || (attendance.status === "present" ? attendance.workedMinutes === 0 : attendance.workedMinutes !== 0))) throw new Error("Attendance status and worked minutes are inconsistent.");
  if (attendance?.status === "rest_day" && !day.restDay) throw new Error("Rest-day attendance must match the dated rest-day schedule.");
}

function validateVersion(version: { id: string; effectiveFrom: string; effectiveTo?: string | null; reference: string; reviewed: boolean }) {
  if (!version || typeof version.id !== "string" || !version.id.trim() || !validDate(version.effectiveFrom) || version.effectiveTo != null && (!validDate(version.effectiveTo) || version.effectiveTo < version.effectiveFrom) || typeof version.reviewed !== "boolean" || typeof version.reference !== "string" || !version.reference.trim()) throw new Error("A valid effective-dated rule version and reference are required.");
}
function validateMatrix(matrix: DailyWageMatrix) {
  if (!matrix || workdayTypes.some((type) => !Number.isSafeInteger(matrix[type]) || matrix[type] < 0)) throw new Error("Configure every day-type multiplier as nonnegative integer basis points.");
}
export function validateClientDailyWagePolicy(policy: ClientDailyWagePolicy, statutory: StatutoryDailyWageRules) {
  validateVersion(policy); validateVersion(statutory);
  if (typeof policy.clientId !== "string" || !policy.clientId.trim() || policy.statutoryRuleId !== statutory.id || typeof policy.requirePrecedingAttendance !== "boolean") throw new Error("Client policy must identify its client and statutory rule version.");
  if (!Number.isInteger(statutory.standardMinutes) || statutory.standardMinutes < 1 || statutory.standardMinutes > 1440 || !Number.isInteger(policy.regularMinutes) || policy.regularMinutes < 1 || policy.regularMinutes > statutory.standardMinutes) throw new Error("Client regular minutes exceed the statutory standard or are invalid.");
  validateMatrix(policy.workedBasisPoints); validateMatrix(policy.unworkedBasisPoints);
  validateMatrix(statutory.minimumWorkedBasisPoints); validateMatrix(statutory.minimumUnworkedBasisPoints);
  for (const type of workdayTypes) {
    if (policy.workedBasisPoints[type] < statutory.minimumWorkedBasisPoints[type] || policy.unworkedBasisPoints[type] < statutory.minimumUnworkedBasisPoints[type]) throw new Error(`Client ${type} rates cannot fall below the applicable statutory minimum.`);
  }
}

export function resolveClientDailyWagePolicy(policies: ClientDailyWagePolicy[], clientId: string, date: string): ClientDailyWagePolicy | null {
  if (!validDate(date) || !clientId?.trim()) throw new Error("Select a client and valid work date.");
  const applicable = policies.filter((policy) => policy.clientId === clientId && policy.effectiveFrom <= date && (!policy.effectiveTo || policy.effectiveTo >= date));
  for (const policy of applicable) validateVersion(policy);
  applicable.sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom));
  if (applicable.length > 1 && applicable[0].effectiveFrom === applicable[1].effectiveFrom) throw new Error("Ambiguous client policy versions for this effective date.");
  // Do not fall back to an older reviewed policy when the newest is unreviewed.
  return applicable[0] || null;
}

// Select one final classification; never multiply every calendar flag together.
export function resolveWorkdayType(holiday: HolidayKind, restDay: boolean): ResolvedWorkday {
  if (!holidays.includes(holiday) || typeof restDay !== "boolean") throw new Error("Invalid workday classification.");
  if (holiday === "double_regular_holiday") return restDay ? "double_regular_holiday_rest_day" : holiday;
  if (holiday === "regular_holiday") return restDay ? "regular_holiday_rest_day" : holiday;
  if (holiday === "special_non_working") return restDay ? "special_non_working_rest_day" : holiday;
  return restDay ? "rest_day" : "ordinary";
}

export function multiplyDailyCentavos(amount: number, basisPoints: number): number {
  if (!Number.isSafeInteger(amount) || amount < 0 || !Number.isSafeInteger(basisPoints) || basisPoints < 0) throw new Error("Wages and multipliers must use nonnegative safe integers.");
  const result = Number((BigInt(amount) * BigInt(basisPoints) + 5000n) / 10000n);
  if (!Number.isSafeInteger(result)) throw new Error("Daily wage exceeds supported precision.");
  return result;
}

export function regularHolidayEligibility(day: WageDayEvidence, history: WageDayEvidence[]): HolidayEligibility {
  validateDay(day);
  if (day.holiday !== "regular_holiday" && day.holiday !== "double_regular_holiday") throw new Error("Eligibility applies to regular holidays only.");
  if (!day.calendarReviewed) return { status: "needs_review", evidenceDate: day.date, reason: "Current holiday classification must be reviewed" };
  if (!Array.isArray(history)) throw new Error("Preceding calendar/attendance history is required.");
  const dates = new Map<string, WageDayEvidence>();
  for (const prior of history) {
    validateDay(prior);
    if (prior.employeeId !== day.employeeId || prior.date >= day.date || dates.has(prior.date)) throw new Error("Holiday history must contain unique earlier dates for this employee only.");
    dates.set(prior.date, prior);
  }
  let date = previousDate(day.date);
  // Require contiguous calendar evidence, including dates outside the cutoff.
  for (let i = 0; i <= dates.size; i++) {
    const prior = dates.get(date);
    if (!prior || !prior.calendarReviewed) return { status: "needs_review", evidenceDate: date, reason: "Missing / unreviewed preceding calendar evidence" };
    const attendance = prior.attendance;
    if (attendance && !attendance.approved) return { status: "needs_review", evidenceDate: date, reason: "Preceding attendance is not approved" };
    if (attendance?.status === "present" || attendance?.status === "paid_leave") return { status: "eligible", evidenceDate: date, reason: "Worked or approved paid leave on the preceding qualifying day" };
    const regularHoliday = prior.holiday === "regular_holiday" || prior.holiday === "double_regular_holiday";
    if (regularHoliday && !attendance) return { status: "needs_review", evidenceDate: date, reason: "Missing attendance for a preceding regular holiday" };
    // Successive unworked regular holidays inherit eligibility; a worked first
    // holiday qualifies the next even if the employee was absent before it.
    if (regularHoliday || !prior.scheduledWorkday || prior.holiday === "special_non_working") { date = previousDate(date); continue; }
    if (!attendance) return { status: "needs_review", evidenceDate: date, reason: "Missing preceding workday attendance" };
    return { status: "ineligible", evidenceDate: date, reason: "Unpaid absence on the preceding qualifying workday" };
  }
  return { status: "needs_review", evidenceDate: date, reason: "Preceding qualifying workday was not supplied" };
}

/** Configured regular-day BASIC wages only; not monthly salary or final gross/net pay. */
export function calculatePhilippineDailyWage(input: DailyWageInput): DailyWageResult {
  validateDay(input.day);
  validateClientDailyWagePolicy(input.policy, input.statutoryRules);
  if (!["daily", "monthly"].includes(input.payBasis) || typeof input.statutoryCoverageConfirmed !== "boolean" || !Number.isSafeInteger(input.basicDailyCentavos) || input.basicDailyCentavos <= 0) throw new Error("Set a valid pay basis, basic daily rate in centavos and coverage confirmation.");
  const dayType = resolveWorkdayType(input.day.holiday, input.day.restDay);
  const policy = input.policy, statutory = input.statutoryRules;
  const versions = { policyId: policy.id, statutoryRuleId: statutory.id };
  const blocked = (reason: string, eligibility: HolidayEligibility | null = null): DailyWageResult => ({ ...versions, status: "needs_review", dayType, payCentavos: null, appliedBasisPoints: null, eligibility, reason });
  const calculated = (basisPoints: number, reason: string, eligibility: HolidayEligibility | null = null): DailyWageResult => ({ ...versions, status: "calculated", dayType, payCentavos: multiplyDailyCentavos(input.basicDailyCentavos, basisPoints), appliedBasisPoints: basisPoints, eligibility, reason });
  if (policy.clientId !== input.day.clientId) throw new Error("Payroll policy belongs to another client.");
  if ([policy, statutory].some((v) => !v.reviewed || v.effectiveFrom > input.day.date || v.effectiveTo != null && v.effectiveTo < input.day.date)) return blocked("Client policy and statutory rules must be reviewed and effective on the work date");
  if (!input.statutoryCoverageConfirmed) return blocked("Statutory holiday / premium-pay coverage must be confirmed");
  if (input.payBasis !== "daily") return blocked("Monthly salary inclusion and conversion require a separate reviewed policy");
  if (!input.day.calendarReviewed) return blocked("Day classification must be reviewed");
  const attendance = input.day.attendance;
  if (!attendance?.approved) return blocked("Current attendance must be recorded and approved");
  if (attendance.status === "present") {
    if (attendance.workedMinutes !== policy.regularMinutes) return blocked("Partial-day / overtime allocation requires a separate calculation");
    return calculated(policy.workedBasisPoints[dayType], "Worked full configured regular day; one resolved multiplier applied");
  }
  if (input.day.holiday === "regular_holiday" || input.day.holiday === "double_regular_holiday") {
    const eligibility: HolidayEligibility = policy.requirePrecedingAttendance ? regularHolidayEligibility(input.day, input.history) : { status: "eligible", evidenceDate: null, reason: "Reviewed favorable client policy waives preceding-attendance condition" };
    if (eligibility.status === "needs_review") return blocked(eligibility.reason, eligibility);
    const entitlement = policy.unworkedBasisPoints[dayType];
    return calculated(eligibility.status === "eligible" ? entitlement : 0, "Unworked regular-holiday entitlement; no worked/rest-day premium added", eligibility);
  }
  if (input.day.holiday === "special_non_working") {
    const benefit = input.specialUnworkedBenefit;
    if (benefit) {
      if (!Number.isSafeInteger(benefit.amountCentavos) || benefit.amountCentavos < 0 || typeof benefit.reference !== "string" || !benefit.reference.trim()) throw new Error("Invalid favorable special-day benefit.");
      if (benefit.reviewed !== true) return blocked("Special-day company / CBA benefit must be reviewed");
      return { ...versions, status: "calculated", dayType, payCentavos: Math.max(benefit.amountCentavos, multiplyDailyCentavos(input.basicDailyCentavos, policy.unworkedBasisPoints[dayType])), appliedBasisPoints: null, eligibility: null, reason: "Reviewed favorable company / CBA benefit replaces no-work-no-pay" };
    }
    if (attendance.status === "paid_leave") return blocked("Approved paid-leave entitlement must be calculated separately");
    return calculated(policy.unworkedBasisPoints[dayType], "Unworked special day: configured client benefit or no-work-no-pay");
  }
  if (attendance.status === "paid_leave") return blocked("Approved paid-leave entitlement must be calculated separately");
  return calculated(policy.unworkedBasisPoints[dayType], "Unworked ordinary / rest day under client policy");
}
