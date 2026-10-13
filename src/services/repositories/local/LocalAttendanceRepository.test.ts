import { afterEach, describe, expect, it } from "vitest";
import type { AccessProfile } from "../../access/accessControl";
import type { AttendanceInput } from "../../../types/attendance";
import { LocalAttendanceRepository } from "./LocalAttendanceRepository";
import { LocalPayrollRepository } from "./LocalPayrollRepository";
import { LocalOrganizationDirectoryRepository } from "./LocalOrganizationDirectoryRepository";
import { LocalEmployeeRepository } from "./LocalEmployeeRepository";

const admin: AccessProfile = { userId: "70000000-0000-4000-8000-000000000001", displayName: "Admin", role: "super_admin", scopeType: "organization", branchIds: [] };
afterEach(() => localStorage.clear());
async function setup() {
  const payroll = new LocalPayrollRepository(admin), attendance = new LocalAttendanceRepository(admin);
  const branch = (await new LocalOrganizationDirectoryRepository().getDirectory()).branches[0];
  const employee = (await new LocalEmployeeRepository().list({ limit: 1 }))[0];
  const site = await payroll.save({ kind: "worksite", data: { label: "Attendance site", reason: "Setup", branch_id: branch.id, region: "XI", province: "Davao", city: "Davao", category: "Test" } });
  const terms = await payroll.save({ kind: "employee_terms", data: { label: "Employee terms", reason: "Agreement", employee_id: employee.id, worksite_id: site.id, effective_from: "2026-01-01", pay_basis: "daily", rate_centavos: 60000, frequency: "semi_monthly", payroll_group: "A", shift_start: "08:00", shift_end: "17:00", break_minutes: 60, rest_days: [0], allowances: [] } });
  const input: AttendanceInput = { employee_id: employee.id, employee_label: "Employee", work_date: "2026-10-12", status: "present", reason: "Daily log", terms_id: terms.id, segments: [{ time_in: "08:00", time_out: "17:00", in_next_day: false, out_next_day: false, break_minutes: 60 }] };
  return { payroll, attendance, input, terms };
}
describe("local attendance persistence", () => {
  it("preserves correction history, locks approved records, and protects their referenced terms", async () => {
    const { payroll, attendance, input, terms } = await setup();
    await attendance.saveBatch([input]);
    const first = (await attendance.list({})).items[0];
    await attendance.saveBatch([{ ...input, replace_id: first.id, reason: "Corrected punch", segments: [{ ...input.segments[0], time_in: "08:15" }] }]);
    expect((await attendance.list({ includeArchived: true })).total).toBe(2);
    const corrected = (await attendance.list({})).items[0];
    expect(corrected.supersedes_id).toBe(first.id);
    expect(corrected.terms_snapshot.rate_centavos).toBe(60000);
    await attendance.approve(corrected.id);
    await expect(attendance.saveBatch([{ ...input, replace_id: corrected.id }])).rejects.toThrow("current draft");
    await expect(payroll.archive(terms.id)).rejects.toThrow("Approved attendance");
  });
  it("rejects duplicate days atomically and requires approval permission", async () => {
    const { attendance, input } = await setup();
    await attendance.saveBatch([input]);
    await expect(attendance.saveBatch([{ ...input, work_date: "2026-10-13" }, input])).rejects.toThrow("already exists");
    expect((await attendance.list({})).total).toBe(1);
    const id = (await attendance.list({})).items[0].id;
    const manager = new LocalAttendanceRepository({ ...admin, role: "custom", effectivePermissions: ["payroll.view", "payroll.manage"] });
    await expect(manager.approve(id)).rejects.toThrow("access");
  });
  it("detects changed terms before approval and resolves a revised draft against the new rate", async () => {
    const { payroll, attendance, input, terms } = await setup();
    await attendance.saveBatch([input]);
    const draft = (await attendance.list({})).items[0];
    const revised = await payroll.save({ kind: "employee_terms", data: { ...terms.data, effective_from: "2026-10-08", rate_centavos: 65000 } });
    await expect(attendance.approve(draft.id)).rejects.toThrow("Pay terms changed");
    await attendance.saveBatch([{ ...input, replace_id: draft.id, terms_id: revised.id, reason: "Adopt approved new terms" }]);
    expect((await attendance.list({})).items[0].terms_snapshot.rate_centavos).toBe(65000);
  });
});
