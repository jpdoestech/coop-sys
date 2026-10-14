import { describe, expect, it } from "vitest";
import { calculatePhilippineDailyWage, multiplyDailyCentavos, regularHolidayEligibility, resolveWorkdayType, resolveClientDailyWagePolicy, validateClientDailyWagePolicy } from "./philippineDailyWage";
import type { ClientDailyWagePolicy, DailyWageInput, DailyWageMatrix, HolidayKind, StatutoryDailyWageRules, WageDayEvidence } from "./philippineDailyWage";

const worked: DailyWageMatrix = { ordinary: 10000, rest_day: 13000, special_non_working: 13000, special_non_working_rest_day: 15000, regular_holiday: 20000, regular_holiday_rest_day: 26000, double_regular_holiday: 30000, double_regular_holiday_rest_day: 39000 };
const unworkedRates: DailyWageMatrix = { ordinary: 0, rest_day: 0, special_non_working: 0, special_non_working_rest_day: 0, regular_holiday: 10000, regular_holiday_rest_day: 10000, double_regular_holiday: 20000, double_regular_holiday_rest_day: 20000 };
function configuration(): { policy: ClientDailyWagePolicy; statutoryRules: StatutoryDailyWageRules } {
  return {
    statutoryRules: { id: "dole-reviewed-version", effectiveFrom: "2025-01-01", reviewed: true, reference: "DOLE handbook", standardMinutes: 480, minimumWorkedBasisPoints: { ...worked }, minimumUnworkedBasisPoints: { ...unworkedRates } },
    policy: { id: "client-policy-version", clientId: "client-1", statutoryRuleId: "dole-reviewed-version", effectiveFrom: "2025-01-01", reviewed: true, reference: "Reviewed client agreement", regularMinutes: 480, workedBasisPoints: { ...worked }, unworkedBasisPoints: { ...unworkedRates }, requirePrecedingAttendance: true },
  };
}

function day(date = "2026-01-02", holiday: HolidayKind = "ordinary", restDay = false): WageDayEvidence {
  return { employeeId: "employee-1", clientId: "client-1", date, holiday, restDay, scheduledWorkday: !restDay, calendarReviewed: true, attendance: { status: "present", approved: true, workedMinutes: 480 } };
}
function input(holiday: HolidayKind = "ordinary", restDay = false): DailyWageInput {
  return { ...configuration(), payBasis: "daily", basicDailyCentavos: 60000, statutoryCoverageConfirmed: true, day: day("2026-01-02", holiday, restDay), history: [day("2026-01-01")] };
}
function unworked(value: WageDayEvidence): WageDayEvidence {
  return { ...value, attendance: { status: "absent", approved: true, workedMinutes: 0 } };
}

describe("Philippine basic daily wages", () => {
  it.each([
    ["ordinary", false, 60000, 10000], ["ordinary", true, 78000, 13000],
    ["special_working", false, 60000, 10000], ["special_working", true, 78000, 13000],
    ["special_non_working", false, 78000, 13000], ["special_non_working", true, 90000, 15000],
    ["regular_holiday", false, 120000, 20000], ["regular_holiday", true, 156000, 26000],
    ["double_regular_holiday", false, 180000, 30000], ["double_regular_holiday", true, 234000, 39000],
  ] as const)("resolves %s / rest=%s exactly once", (holiday, restDay, payCentavos, appliedBasisPoints) => {
    expect(calculatePhilippineDailyWage(input(holiday, restDay))).toMatchObject({ status: "calculated", payCentavos, appliedBasisPoints });
  });
  it("never applies an extra rest-day multiplier to the resolved regular holiday", () => {
    const result = calculatePhilippineDailyWage(input("regular_holiday", true));
    expect(result.dayType).toBe("regular_holiday_rest_day");
    expect(result.payCentavos).toBe(156000);
    expect(result.payCentavos).not.toBe(202800);
  });
  it.each([false, true])("pays zero for an unworked special day, rest=%s", (restDay) => {
    const value = input("special_non_working", restDay); value.day = unworked(value.day);
    expect(calculatePhilippineDailyWage(value).payCentavos).toBe(0);
  });
  it.each(["regular_holiday", "double_regular_holiday"] as const)("pays the unworked %s entitlement without rest-day premium", (holiday) => {
    const value = input(holiday, true); value.day = unworked(value.day);
    expect(calculatePhilippineDailyWage(value)).toMatchObject({ payCentavos: holiday === "regular_holiday" ? 60000 : 120000, eligibility: { status: "eligible", evidenceDate: "2026-01-01" } });
  });
  it("accepts approved paid leave on the preceding workday", () => {
    const value = input("regular_holiday"); value.day = unworked(value.day);
    value.history[0].attendance = { status: "paid_leave", approved: true, workedMinutes: 0 };
    expect(calculatePhilippineDailyWage(value).payCentavos).toBe(60000);
  });
  it.each(["absent", "unpaid_leave", "awol"] as const)("denies unworked holiday entitlement after preceding %s", (status) => {
    const value = input("regular_holiday"); value.day = unworked(value.day);
    value.history[0].attendance = { status, approved: true, workedMinutes: 0 };
    expect(calculatePhilippineDailyWage(value)).toMatchObject({ status: "calculated", payCentavos: 0, eligibility: { status: "ineligible" } });
  });
  it("does not deny worked holiday wages because of prior unpaid absence", () => {
    const value = input("regular_holiday"); value.history[0] = unworked(value.history[0]);
    expect(calculatePhilippineDailyWage(value).payCentavos).toBe(120000);
  });
  it("walks contiguous rest/non-working calendar days across a cutoff/year boundary", () => {
    const value = input("regular_holiday"); value.day = unworked(value.day);
    value.history = [{ ...day("2026-01-01", "ordinary", true), attendance: null }, day("2025-12-31")];
    expect(calculatePhilippineDailyWage(value).eligibility).toMatchObject({ status: "eligible", evidenceDate: "2025-12-31" });
    value.history.pop();
    expect(calculatePhilippineDailyWage(value)).toMatchObject({ status: "needs_review", payCentavos: null });
  });
  it("does not skip an absent scheduled workday to find an earlier present day", () => {
    const value = input("regular_holiday"); value.day = unworked(value.day);
    value.history = [day("2025-12-31"), unworked(day("2026-01-01"))];
    expect(calculatePhilippineDailyWage(value).eligibility?.status).toBe("ineligible");
  });
  it("carries eligibility through successive unworked regular holidays", () => {
    const value = input("regular_holiday"); value.day = unworked(value.day);
    value.history = [unworked(day("2026-01-01", "regular_holiday")), day("2025-12-31")];
    expect(calculatePhilippineDailyWage(value).payCentavos).toBe(60000);
    value.history[1] = unworked(value.history[1]);
    expect(calculatePhilippineDailyWage(value).payCentavos).toBe(0);
    value.history[0] = day("2026-01-01", "regular_holiday");
    expect(calculatePhilippineDailyWage(value).payCentavos).toBe(60000);
  });
  it.each(["missing", "pending", "calendar", "gap"])("blocks unknown preceding evidence: %s", (variant) => {
    const value = input("regular_holiday"); value.day = unworked(value.day);
    if (variant === "missing") value.history[0].attendance = null;
    if (variant === "pending") value.history[0].attendance!.approved = false;
    if (variant === "calendar") value.history[0].calendarReviewed = false;
    if (variant === "gap") value.history[0].date = "2025-12-31";
    expect(calculatePhilippineDailyWage(value)).toMatchObject({ status: "needs_review", payCentavos: null });
  });
  it("preserves favorable reviewed company/CBA special-day benefits", () => {
    const value = input("special_non_working"); value.day = unworked(value.day);
    value.specialUnworkedBenefit = { amountCentavos: 60000, reviewed: true, reference: "Effective client CBA" };
    expect(calculatePhilippineDailyWage(value)).toMatchObject({ payCentavos: 60000, appliedBasisPoints: null });
    value.specialUnworkedBenefit.reviewed = false;
    expect(calculatePhilippineDailyWage(value).payCentavos).toBeNull();
  });
  it.each(["monthly", "coverage", "pending", "calendar", "short", "overtime", "leave"])("does not silently calculate unsupported/unreviewed %s", (variant) => {
    const value = input();
    if (variant === "monthly") value.payBasis = "monthly";
    if (variant === "coverage") value.statutoryCoverageConfirmed = false;
    if (variant === "pending") value.day.attendance!.approved = false;
    if (variant === "calendar") value.day.calendarReviewed = false;
    if (variant === "short") value.day.attendance!.workedMinutes = 240;
    if (variant === "overtime") value.day.attendance!.workedMinutes = 540;
    if (variant === "leave") value.day.attendance = { status: "paid_leave", approved: true, workedMinutes: 0 };
    expect(calculatePhilippineDailyWage(value)).toMatchObject({ status: "needs_review", payCentavos: null });
  });
  it("rejects duplicates, other employees, same-day/future history and invalid dates", () => {
    const value = input("regular_holiday");
    for (const history of [[day("2026-01-01"), day("2026-01-01")], [{ ...day("2026-01-01"), employeeId: "employee-2" }], [day("2026-01-02")], [day("2026-01-03")], [day("2026-02-30")]]) {
      expect(() => regularHolidayEligibility(value.day, history)).toThrow();
    }
  });
  it("rejects inconsistent attendance and schedule instead of calculating pay", () => {
    const value = input(); value.day.attendance = { status: "absent", approved: true, workedMinutes: 480 };
    expect(() => calculatePhilippineDailyWage(value)).toThrow("inconsistent");
    value.day = day("2026-01-02", "ordinary", true); value.day.scheduledWorkday = true;
    expect(() => calculatePhilippineDailyWage(value)).toThrow("schedule");
    expect(() => resolveWorkdayType("invalid" as HolidayKind, false)).toThrow();
  });
  it("rounds half-up once in centavos and rejects unsafe/fractional amounts", () => {
    expect(multiplyDailyCentavos(1, 15000)).toBe(2);
    expect(multiplyDailyCentavos(60001, 26000)).toBe(156003);
    for (const amount of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1]) expect(() => multiplyDailyCentavos(amount, 26000)).toThrow();
    expect(() => multiplyDailyCentavos(Number.MAX_SAFE_INTEGER, 39000)).toThrow("precision");
    expect(() => multiplyDailyCentavos(100, 1.3)).toThrow();
  });
  it("uses client-configured premiums instead of a hard-coded matrix", () => {
    const value = input("regular_holiday", true);
    value.policy.workedBasisPoints.regular_holiday_rest_day = 30000;
    expect(calculatePhilippineDailyWage(value)).toMatchObject({ payCentavos: 180000, appliedBasisPoints: 30000, policyId: value.policy.id });
    const special = input("special_non_working"); special.day = unworked(special.day);
    special.policy.unworkedBasisPoints.special_non_working = 10000;
    expect(calculatePhilippineDailyWage(special).payCentavos).toBe(60000);
  });
  it("validates against supplied statutory floors without hard-coding those floors", () => {
    const value = input("regular_holiday", true);
    value.statutoryRules.minimumWorkedBasisPoints.regular_holiday_rest_day = 28000;
    expect(() => calculatePhilippineDailyWage(value)).toThrow("statutory minimum");
    value.policy.workedBasisPoints.regular_holiday_rest_day = 28000;
    expect(calculatePhilippineDailyWage(value).payCentavos).toBe(168000);
  });
  it("requires every matrix entry and rejects fractions or below-minimum values", () => {
    for (const rate of [undefined, -1, 13000.5, 25000]) {
      const value = input(); value.policy.workedBasisPoints.regular_holiday_rest_day = rate as number;
      expect(() => validateClientDailyWagePolicy(value.policy, value.statutoryRules)).toThrow();
    }
    const value = input(); value.policy.unworkedBasisPoints.regular_holiday = 0;
    expect(() => validateClientDailyWagePolicy(value.policy, value.statutoryRules)).toThrow("statutory minimum");
  });
  it("enforces policy client identity and statutory version identity", () => {
    const value = input(); value.policy.clientId = "client-2";
    expect(() => calculatePhilippineDailyWage(value)).toThrow("another client");
    value.policy.clientId = "client-1"; value.policy.statutoryRuleId = "other-version";
    expect(() => calculatePhilippineDailyWage(value)).toThrow("statutory rule");
  });
  it.each(["pending policy", "pending statute", "future policy", "expired policy", "future statute", "expired statute"])("blocks %s", (variant) => {
    const value = input();
    const config = variant.includes("statute") ? value.statutoryRules : value.policy;
    if (variant.startsWith("pending")) config.reviewed = false;
    if (variant.startsWith("future")) config.effectiveFrom = "2026-01-03";
    if (variant.startsWith("expired")) config.effectiveTo = "2026-01-01";
    expect(calculatePhilippineDailyWage(value)).toMatchObject({ status: "needs_review", payCentavos: null });
  });
  it("resolves client policy changes on effectivity, without falling back from an unreviewed version", () => {
    const old = configuration().policy, newer = { ...old, id: "new-version", effectiveFrom: "2026-01-02", reviewed: false };
    expect(resolveClientDailyWagePolicy([old, newer], "client-1", "2026-01-01")?.id).toBe(old.id);
    expect(resolveClientDailyWagePolicy([old, newer], "client-1", "2026-01-02")?.id).toBe(newer.id);
    expect(resolveClientDailyWagePolicy([old, newer], "client-2", "2026-01-02")).toBeNull();
    expect(() => resolveClientDailyWagePolicy([newer, { ...newer, id: "ambiguous" }], "client-1", "2026-01-02")).toThrow("Ambiguous");
  });
  it("supports a more favorable client waiver of preceding-attendance eligibility", () => {
    const value = input("regular_holiday"); value.day = unworked(value.day); value.history = [];
    value.policy.requirePrecedingAttendance = false;
    expect(calculatePhilippineDailyWage(value)).toMatchObject({ payCentavos: 60000, eligibility: { status: "eligible", evidenceDate: null } });
  });
  it("uses configured full-day minutes without changing statutory premium rates", () => {
    const value = input("special_non_working"); value.policy.regularMinutes = 420; value.day.attendance!.workedMinutes = 420;
    expect(calculatePhilippineDailyWage(value).payCentavos).toBe(78000);
    value.policy.regularMinutes = 540;
    expect(() => calculatePhilippineDailyWage(value)).toThrow("statutory standard");
  });
  it("does not reduce configured benefits when a separate reviewed fixed benefit is lower", () => {
    const value = input("special_non_working"); value.day = unworked(value.day);
    value.policy.unworkedBasisPoints.special_non_working = 10000;
    value.specialUnworkedBenefit = { amountCentavos: 10000, reviewed: true, reference: "Reviewed benefit" };
    expect(calculatePhilippineDailyWage(value).payCentavos).toBe(60000);
  });
});
