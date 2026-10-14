import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { AccessContextValue } from "../../services/access/accessContextValue";
import { OrganizationContextValue } from "../../services/organization/organizationContextValue";
import { EmployeePayrollTermsDialog } from "./EmployeePayrollTermsDialog";
import type { PayrollRecord } from "../../types/payroll";
const { saveBatch, workDateRecords } = vi.hoisted(() => ({ saveBatch: vi.fn(), workDateRecords: vi.fn() }));
vi.mock("../../services/repositories/payrollRepositoryFactory", () => ({ createPayrollRepository: () => ({ saveBatch, workDateRecords, list: vi.fn() }) }));
vi.mock("../../services/activity/transactionNotifications", () => ({ showTransactionSuccess: vi.fn().mockResolvedValue(undefined) }));
const employees = [1, 2].map((i) => ({ id: `10000000-0000-4000-8000-${String(i).padStart(12,"0")}`, employee_number: `00000${i}`, first_name: `Person${i}`, last_name: "QA" }));
const site = { id: "10000000-0000-4000-8000-000000000003", kind: "worksite", data: { label: "Factory" }, deleted_at: null } as PayrollRecord;
function setup() {
  saveBatch.mockReset().mockResolvedValue([]);
  workDateRecords.mockReset().mockImplementation(async (id: string) => [site, { id: `20000000-0000-4000-8000-${id.slice(-12)}`, kind: "employee_terms", deleted_at: null, data: { label: "Terms", reason: "Agreement", employee_id: id, worksite_id: site.id, worksite_label: "Factory", effective_from: "2026-01-01", pay_basis: "daily", rate_centavos: 60000, frequency: "semi_monthly", payroll_group: "A", shift_start: "08:00", shift_end: "17:00", break_minutes: 60, rest_days: [id === employees[0].id ? 0 : 2], allowances: [] } }]);
  const close = vi.fn();
  const directory = { branches: [], clients: [], departments: [], positions: [], loading: false, error: null, saveBranch: vi.fn(), saveClient: vi.fn(), saveDepartment: vi.fn(), savePosition: vi.fn() };
  render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><AccessContextValue.Provider value={{ userId:"admin",displayName:"Admin",role:"super_admin",branchIds:[],scopeType:"organization" }}><OrganizationContextValue.Provider value={directory}><EmployeePayrollTermsDialog employees={employees} onClose={close} /></OrganizationContextValue.Provider></AccessContextValue.Provider></QueryClientProvider>);
  return close;
}
describe("employee bulk terms UI", () => {
  it("requires a review before saving and preserves distinct rest days in the atomic batch", async () => {
    const close = setup();
    fireEvent.change(await screen.findByLabelText("New rate / salary (PHP)"), {target:{value:"650"}});
    fireEvent.change(screen.getByLabelText("Change reason"), {target:{value:"Client wage increase"}});
    fireEvent.click(screen.getByRole("button",{name:"Review changes"}));
    await screen.findByRole("table",{name:"Employee terms change preview"});
    expect(saveBatch).not.toHaveBeenCalled(); expect(close).not.toHaveBeenCalled();
    expect(screen.getByText("Sun")).toBeInTheDocument(); expect(screen.getByText("Tue")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button",{name:"Apply 2 employee changes"}));
    await waitFor(()=>expect(saveBatch).toHaveBeenCalledOnce());
    expect(saveBatch.mock.calls[0][0].map((r: PayrollRecord)=>r.data.rest_days)).toEqual([[0],[2]]);
    expect(saveBatch.mock.calls[0][0].every((r: PayrollRecord)=>r.data.rate_centavos===65000)).toBe(true);
    await waitFor(()=>expect(close).toHaveBeenCalledOnce());
  });
  it("invalidates the preview when a field changes", async () => {
    setup(); await screen.findByLabelText("New rate / salary (PHP)");
    fireEvent.change(screen.getByLabelText("Change reason"), {target:{value:"Rest day update"}});
    fireEvent.click(screen.getByRole("button",{name:"Review changes"}));
    await screen.findByRole("table",{name:"Employee terms change preview"});
    fireEvent.change(screen.getByLabelText("New rate / salary (PHP)"), {target:{value:"700"}});
    expect(screen.queryByRole("table",{name:"Employee terms change preview"})).not.toBeInTheDocument();
    expect(screen.getByRole("button",{name:"Review changes"})).toBeInTheDocument(); expect(saveBatch).not.toHaveBeenCalled();
  });
});
