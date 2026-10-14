import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { AccessContextValue } from "../../services/access/accessContextValue";
import { OrganizationContextValue } from "../../services/organization/organizationContextValue";
import { UnsavedChangesProvider } from "../../components/forms/UnsavedChangesProvider";
import { AttendanceWorksheet } from "./AttendanceWorksheet";
import type { AttendanceRepository } from "../../services/repositories/AttendanceRepository";
import type { PayrollRepository } from "../../services/repositories/PayrollRepository";
import type { AttendanceTeamRow } from "../../services/payroll/attendanceTeam";
import type { PayrollRecord } from "../../types/payroll";
import type { AttendanceRecord } from "../../types/attendance";
vi.mock("../../services/activity/transactionNotifications", () => ({ showTransactionSuccess: vi.fn().mockResolvedValue(undefined) }));
const siteId = "10000000-0000-4000-8000-000000000001";
const terms = { id: "10000000-0000-4000-8000-000000000002", kind: "employee_terms", data: { label: "Operator", reason: "Agreement", worksite_id: siteId, shift_start: "08:00", shift_end: "17:00", break_minutes: 60, rest_days: [0], rate_centavos: 60000 } } as PayrollRecord;
const ids = ["10000000-0000-4000-8000-000000000003", "10000000-0000-4000-8000-000000000004"];
const labels = ["000001 - Dela Cruz, Juan", "000002 - Santos, Maria"];
function setup() {
  const rows: AttendanceTeamRow[] = ids.map((id, i) => ({ employeeId: id, employeeLabel: labels[i], date: "2026-10-12", terms: { ...terms, data: { ...terms.data, employee_id: id } }, baseTerms: terms, attendance: null, neighbors: [], restDay: false }));
  rows.push({ ...rows[0], employeeId: "10000000-0000-4000-8000-000000000005", employeeLabel: "Approved employee", attendance: { id: siteId, terms_id: terms.id, review_status: "approved", status: "present", segments: [{ time_in: "08:00", time_out: "17:00", in_next_day: false, out_next_day: false, break_minutes: 60 }] } as AttendanceRecord });
  const saveBatch = vi.fn().mockResolvedValue(undefined);
  const repository = { worksheet: vi.fn().mockResolvedValue({ items: rows, total: rows.length }), saveBatch, saveCutoffBatch: vi.fn(), list: vi.fn(), approve: vi.fn() } as AttendanceRepository;
  const payroll = { list: vi.fn().mockResolvedValue({ items: [{ id: siteId, data: { label: "Production site" } }], total: 1 }), save: vi.fn(), saveBatch: vi.fn(), archive: vi.fn(), workDateRecords: vi.fn() } as PayrollRepository;
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const directory = { branches: [], clients: [], departments: [], positions: [], loading: false, error: null, saveBranch: vi.fn(), saveClient: vi.fn(), saveDepartment: vi.fn(), savePosition: vi.fn() };
  const router = createMemoryRouter([{ path: "/", element: <QueryClientProvider client={client}><AccessContextValue.Provider value={{ userId: siteId, displayName: "QA", role: "super_admin", scopeType: "organization", branchIds: [] }}><OrganizationContextValue.Provider value={directory}><UnsavedChangesProvider><AttendanceWorksheet repository={repository} payroll={payroll} onImport={vi.fn()} /></UnsavedChangesProvider></OrganizationContextValue.Provider></AccessContextValue.Provider></QueryClientProvider> }]);
  render(<RouterProvider router={router} />);
  return { saveBatch };
}
async function loadTeam() {
  fireEvent.focus(screen.getByRole("combobox", { name: "Attendance worksite" }));
  fireEvent.click(await screen.findByRole("option", { name: "Production site" }));
  await screen.findByLabelText(`Select ${labels[0]}`);
}
describe("team attendance interaction", () => {
  it("does not auto-record the roster, keeps approvals locked, and preserves unselected edits on save", async () => {
    const { saveBatch } = setup(); await loadTeam();
    expect(saveBatch).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Select Approved employee")).toBeDisabled();
    fireEvent.click(screen.getByLabelText("Select editable rows on this page"));
    fireEvent.click(screen.getByRole("button", { name: "Apply schedule" }));
    expect(screen.getByLabelText(`Time in ${labels[0]}`)).toHaveValue("08:00");
    fireEvent.input(screen.getByLabelText(`Time in ${labels[0]}`), { target: { value: "08:15" } });
    expect(screen.getByText("Late 15 min")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(`Select ${labels[1]}`));
    fireEvent.change(screen.getByLabelText("Worksheet attendance reference"), { target: { value: "Verified daily log" } });
    fireEvent.click(screen.getByRole("button", { name: "Save 1 changed" }));
    await waitFor(() => expect(saveBatch).toHaveBeenCalledOnce());
    expect(saveBatch.mock.calls[0][0]).toHaveLength(1);
    expect(saveBatch.mock.calls[0][0][0]).toMatchObject({ employee_id: ids[0], reason: "Verified daily log" });
    await waitFor(() => expect(screen.getByRole("button", { name: "Save 0 changed" })).toBeDisabled());
    expect(screen.getByLabelText(`Time in ${labels[1]}`)).toHaveValue("08:00");
    expect(screen.getByText("Unsaved changes")).toBeInTheDocument();
  });
  it("asks before discarding inline edits when the work date changes", async () => {
    setup(); await loadTeam();
    fireEvent.click(screen.getByLabelText(`Select ${labels[0]}`));
    fireEvent.click(screen.getByRole("button", { name: "Apply schedule" }));
    fireEvent.change(screen.getByLabelText("Work date"), { target: { value: "2026-10-13" } });
    expect(await screen.findByRole("alertdialog")).toHaveTextContent("Discard unsaved changes?");
    fireEvent.click(screen.getByRole("button", { name: "Continue editing" }));
    expect(screen.getByLabelText(`Time in ${labels[0]}`)).toHaveValue("08:00");
  });
});
