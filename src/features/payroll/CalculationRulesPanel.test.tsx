import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { CalculationRulesPanel } from "./CalculationRulesPanel";
import { PayrollCalculationPreview } from "./PayrollCalculationPreview";
import { AccessContextValue } from "../../services/access/accessContextValue";
import type { PayrollRunRepository } from "../../services/repositories/PayrollRunRepository";
import type { PayrollRepository } from "../../services/repositories/PayrollRepository";
import type { PayrollRun } from "../../types/payrollRun";
vi.mock("../../services/activity/transactionNotifications", () => ({ showTransactionSuccess: vi.fn().mockResolvedValue(undefined) }));
const id = "10000000-0000-4000-8000-000000000001";
function setup() {
  const saveRules = vi.fn().mockResolvedValue(undefined), repository = { listRules: vi.fn().mockResolvedValue({ items: [], total: 0 }), saveRules } as unknown as PayrollRunRepository;
  const payroll = { list: vi.fn().mockResolvedValue({ items: [{ id, data: { label: "Factory" } }], total: 1 }) } as unknown as PayrollRepository;
  render(<QueryClientProvider client={new QueryClient()}><AccessContextValue.Provider value={{ userId: id, displayName: "QA", role: "super_admin", scopeType: "organization", branchIds: [] }}><CalculationRulesPanel repository={repository} payroll={payroll} /></AccessContextValue.Provider></QueryClientProvider>);
  return { saveRules };
}
async function selectSite() {
  fireEvent.focus(screen.getByRole("combobox", { name: "Calculation worksite" }));
  fireEvent.click(await screen.findByRole("option", { name: "Factory" }));
}
describe("calculation rules UI", () => {
  it("requires explicit allowance treatment and preserves the selected review state", async () => {
    const { saveRules } = setup(); await selectSite();
    fireEvent.click(screen.getByRole("button", { name: "New version" }));
    expect(screen.getByLabelText("Worked-day allowance")).toHaveValue("");
    expect(screen.getByLabelText("Reviewed against the approved worksite rules")).not.toBeChecked();
    fireEvent.input(screen.getByLabelText("Effective from"), { target: { value: "2026-10-01" } });
    fireEvent.change(screen.getByLabelText("Payroll group"), { target: { value: "A" } });
    fireEvent.change(screen.getByLabelText("Regular paid minutes"), { target: { value: "480" } });
    fireEvent.change(screen.getByLabelText("Worked-day allowance"), { target: { value: "full" } });
    fireEvent.change(screen.getByLabelText("Review / change reference"), { target: { value: "Draft policy pending review" } });
    fireEvent.click(screen.getByRole("button", { name: "Save new versions" }));
    await waitFor(() => expect(saveRules).toHaveBeenCalledOnce());
    expect(saveRules.mock.calls[0][0][0]).toMatchObject({ reviewed: false, regular_minutes: 480, short_day: "block", worked_allowance: "full" });
  });
  it("never defaults days to ordinary and saves an explicit reviewed range atomically", async () => {
    const { saveRules } = setup(); await selectSite();
    fireEvent.click(screen.getByRole("button", { name: "Day classifications" }));
    fireEvent.click(screen.getByRole("button", { name: "New version" }));
    expect(screen.getByLabelText("Day classification")).toHaveValue("");
    fireEvent.input(screen.getByLabelText("From date"), { target: { value: "2026-10-12" } });
    fireEvent.input(screen.getByLabelText("To date"), { target: { value: "2026-10-13" } });
    fireEvent.change(screen.getByLabelText("Day classification"), { target: { value: "ordinary" } });
    fireEvent.click(screen.getByLabelText("Reviewed against the approved worksite rules"));
    fireEvent.change(screen.getByLabelText("Review / change reference"), { target: { value: "Verified client calendar" } });
    fireEvent.click(screen.getByRole("button", { name: "Save new versions" }));
    await waitFor(() => expect(saveRules).toHaveBeenCalledOnce());
    expect(saveRules.mock.calls[0][0]).toHaveLength(2);
    expect(saveRules.mock.calls[0][0][1]).toMatchObject({ kind: "calendar", effective_from: "2026-10-13", day_type: "ordinary", reviewed: true });
  });
  it("shows blocked estimates as unavailable rather than a zero-pay result", async () => {
    const run = { id, worksite_id: id, payroll_group: "A", frequency: "semi_monthly", period_start: "2026-10-12", period_end: "2026-10-12", status: "draft" } as PayrollRun;
    const repository = { previewSource: vi.fn().mockResolvedValue({ run, total: 1, setup: [], rules: [], members: {}, rows: [{ employeeId: id, employeeLabel: "Juan", date: "2026-10-12", baseTerms: { data: { worksite_id: id, payroll_group: "A", frequency: "semi_monthly" } }, terms: null, attendance: null }] }) } as unknown as PayrollRunRepository;
    render(<QueryClientProvider client={new QueryClient()}><PayrollCalculationPreview run={run} repository={repository} /></QueryClientProvider>);
    expect(await screen.findByText("Blocked")).toBeInTheDocument();
    expect(screen.getByText("Unavailable")).toBeInTheDocument();
    expect(screen.getByText("Net pay not calculated")).toBeInTheDocument();
  });
});
