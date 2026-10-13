import { describe, expect, it, vi } from "vitest";
import { attendanceTime, prepareAttendanceImport } from "./attendanceImport";
import type { Employee } from "../../types/employee";
import type { PayrollRecord } from "../../types/payroll";
const employee = { id: "10000000-0000-4000-8000-000000000001", employee_number: "000001", last_name: "Dela Cruz", first_name: "Juan", date_hired: "2026-01-01" } as Employee;
const terms = [{ id: "10000000-0000-4000-8000-000000000002", kind: "employee_terms", data: { employee_id: employee.id, effective_from: "2026-01-01", shift_start: "08:00", shift_end: "17:00", break_minutes: 60, rest_days: [0], rate_centavos: 60000 } }] as PayrollRecord[];
const row = { "EMPLOYEE ID": "1", "WORK DATE": "2026-10-12", STATUS: "present", "TIME IN": "08:00", "TIME OUT": "12:00", "BREAK MINUTES": "0", REASON: "Daily log" };
describe("attendance import", () => {
  it("parses Excel fractions and 12-hour clocks without silently truncating seconds", () => {
    expect(attendanceTime(String(8 / 24))).toBe("08:00");
    expect(attendanceTime("12:00 AM")).toBe("00:00");
    expect(attendanceTime("1:30 PM")).toBe("13:30");
    expect(() => attendanceTime("08:00:30")).toThrow("whole-minute");
  });
  it("combines daily segments and normalizes an exact employee ID", async () => {
    const lookup = vi.fn().mockResolvedValue(employee);
    const result = await prepareAttendanceImport([row, { ...row, "TIME IN": "13:00", "TIME OUT": "17:00" }], "daily.xlsx", lookup, async () => terms, async () => false);
    expect(result).toHaveLength(1); expect(result[0].error).toBeNull();
    expect(result[0].input?.segments).toHaveLength(2);
    expect(result[0].rowNumbers).toEqual([2, 3]);
    expect(lookup).toHaveBeenCalledExactlyOnceWith("000001");
  });
  it("flags duplicate imports, mixed statuses, overlaps, and missing pay terms", async () => {
    expect((await prepareAttendanceImport([row], "daily.xlsx", async () => employee, async () => terms, async () => true))[0].error).toContain("already exists");
    expect((await prepareAttendanceImport([row, row], "daily.xlsx", async () => employee, async () => terms, async () => false))[0].error).toContain("overlap");
    expect((await prepareAttendanceImport([row, { ...row, STATUS: "absent" }], "daily.xlsx", async () => employee, async () => terms, async () => false))[0].error).toContain("mixed statuses");
    expect((await prepareAttendanceImport([row], "daily.xlsx", async () => employee, async () => [], async () => false))[0].error).toContain("No dated");
  });
  it("flags both overnight records when different work dates overlap", async () => {
    const result = await prepareAttendanceImport([
      { ...row, "TIME IN": "22:00", "TIME OUT": "06:00", "OUT NEXT DAY": "YES" },
      { ...row, "WORK DATE": "2026-10-13", "TIME IN": "05:00", "TIME OUT": "09:00" },
    ], "daily.xlsx", async () => employee, async () => terms, async () => false);
    expect(result.every((record) => !record.input && record.error?.includes("overlap"))).toBe(true);
  });
});
