import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { PayrollRunsPage } from "./PayrollRunsPage";
import { matrixTestRun } from "./attendanceMatrixTestData";
import type { PayrollRepository } from "../../services/repositories/PayrollRepository";
const mock = vi.hoisted(() => ({ list: vi.fn(), coverage: vi.fn() }));
vi.mock("../../services/repositories/payrollRunRepositoryFactory", () => ({ createPayrollRunRepository: () => mock }));
vi.mock("../../services/access/useAccess", () => ({ useAccess: () => ({ profile: { userId: "qa" }, can: () => true }) }));
describe("inline payroll cutoff navigation", () => {
  it("replaces the list with a non-modal cutoff and restores list filters on return", async () => {
    mock.list.mockResolvedValue({ items: [matrixTestRun], total: 1 });
    mock.coverage.mockResolvedValue({ items: [], total: 0, summary: { employees: 0, expected: 0, missing: 0, drafts: 0, missingTerms: 0, changedTerms: 0, approved: 0 } });
    const changed = vi.fn();
    render(<QueryClientProvider client={new QueryClient()}><PayrollRunsPage payroll={{} as PayrollRepository} onWorkspaceChange={changed} /></QueryClientProvider>);
    fireEvent.change(screen.getByLabelText("Search payroll runs"), { target: { value: "October" } });
    fireEvent.click(await screen.findByRole("button", { name: `Prepare ${matrixTestRun.title}` }));
    expect(screen.queryByLabelText("Search payroll runs")).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Payroll cutoff workspace" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await waitFor(() => expect(changed).toHaveBeenLastCalledWith(true));
    fireEvent.click(screen.getByRole("button", { name: "Back to Payroll Runs" }));
    expect(screen.getByLabelText("Search payroll runs")).toHaveValue("October");
    await waitFor(() => expect(changed).toHaveBeenLastCalledWith(false));
  });
});
