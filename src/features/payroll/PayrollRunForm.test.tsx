import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { PayrollRunForm } from "./PayrollRunForm";
import { PayrollRunCoverage } from "./PayrollRunCoverage";
import type { PayrollRepository } from "../../services/repositories/PayrollRepository";
import type { PayrollRunRepository } from "../../services/repositories/PayrollRunRepository";
import type { PayrollRun } from "../../types/payrollRun";
vi.mock("../../services/activity/transactionNotifications", () => ({ showTransactionSuccess: vi.fn().mockResolvedValue(undefined) }));
const id = "10000000-0000-4000-8000-000000000001";
const run = { id, title: "October cutoff", worksite_id: id, worksite_label: "Factory", payroll_group: "A", frequency: "semi_monthly", period_start: "2026-10-01", period_end: "2026-10-15", pay_date: "2026-10-20", reason: "Client calendar", status: "draft" } as PayrollRun;
describe("run preparation UI", () => {
  it("saves the explicitly entered cutoff and responds to native date input events", async () => {
    const create = vi.fn().mockResolvedValue(run), close = vi.fn();
    const repository = { create, list: vi.fn(), cancel: vi.fn(), coverage: vi.fn() } as PayrollRunRepository;
    const payroll = { list: vi.fn().mockResolvedValue({ items: [{ id, data: { label: "Factory" } }], total: 1 }), save: vi.fn(), archive: vi.fn(), workDateRecords: vi.fn() } as PayrollRepository;
    render(<QueryClientProvider client={new QueryClient()}><PayrollRunForm repository={repository} payroll={payroll} refresh={vi.fn().mockResolvedValue(undefined)} onClose={close} /></QueryClientProvider>);
    fireEvent.change(screen.getByLabelText("Run title"), { target: { value: run.title } });
    fireEvent.focus(screen.getByRole("combobox", { name: "Run worksite" }));
    fireEvent.click(await screen.findByRole("option", { name: "Factory" }));
    fireEvent.change(screen.getByLabelText("Payroll group"), { target: { value: "A" } });
    for (const [label, value] of [["Period start", run.period_start], ["Period end", run.period_end], ["Pay date", run.pay_date]]) fireEvent.input(screen.getByLabelText(label), { target: { value } });
    fireEvent.change(screen.getByLabelText("Preparation reference"), { target: { value: run.reason } });
    fireEvent.click(screen.getByRole("button", { name: "Create draft" }));
    await waitFor(() => expect(close).toHaveBeenCalledOnce());
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ period_start: run.period_start, period_end: run.period_end, pay_date: run.pay_date }));
  });
  it("labels fully reviewed attendance as attendance complete, not calculated payroll", async () => {
    const coverage = vi.fn().mockResolvedValue({ items: [], total: 0, summary: { employees: 1, expected: 15, approved: 15, missing: 0, drafts: 0, missingTerms: 0, changedTerms: 0 } });
    render(<QueryClientProvider client={new QueryClient()}><PayrollRunCoverage run={run} repository={{ coverage } as unknown as PayrollRunRepository} onClose={vi.fn()} /></QueryClientProvider>);
    expect(await screen.findByText("Attendance complete")).toBeInTheDocument();
    expect(screen.getByText("Not calculated")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Approve payroll" })).not.toBeInTheDocument();
  });
});
