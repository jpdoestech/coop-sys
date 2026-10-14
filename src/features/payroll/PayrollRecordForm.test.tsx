import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { OrganizationContextValue } from "../../services/organization/organizationContextValue";
import { PayrollRecordForm } from "./PayrollRecordForm";
import type { PayrollKind, PayrollRecord } from "../../types/payroll";
import type { PayrollRepository } from "../../services/repositories/PayrollRepository";
import { AccessContextValue } from "../../services/access/accessContextValue";

const directory = { branches: [], clients: [], departments: [], positions: [], loading: false, error: null, saveBranch: vi.fn(), saveClient: vi.fn(), saveDepartment: vi.fn(), savePosition: vi.fn() };
function setup(kind: PayrollKind, source?: PayrollRecord) {
  const save = vi.fn().mockResolvedValue({}), onSaved = vi.fn();
  const repository = { save, saveBatch: vi.fn(), list: vi.fn().mockResolvedValue({ items: [], total: 0 }), archive: vi.fn(), workDateRecords: vi.fn() } as PayrollRepository;
  render(<QueryClientProvider client={new QueryClient()}><AccessContextValue.Provider value={{ userId: "admin", displayName: "Admin", role: "super_admin", branchIds: [], scopeType: "organization" }}><OrganizationContextValue.Provider value={directory}><PayrollRecordForm kind={kind} source={source} repository={repository} onClose={vi.fn()} onSaved={onSaved} /></OrganizationContextValue.Provider></AccessContextValue.Provider></QueryClientProvider>);
  return { save, onSaved };
}
describe("payroll setup forms", () => {
  it("starts the cooperative policy at 50 pesos and saves the effective date and reason", async () => {
    const { save, onSaved } = setup("cooperative_policy");
    expect(screen.getByLabelText("Default cooperative deduction per cutoff (PHP)")).toHaveValue(50);
    fireEvent.change(screen.getByLabelText("Record name"), { target: { value: "Cooperative default" } });
    fireEvent.change(screen.getByLabelText("Change reason"), { target: { value: "Approved cutoff contribution" } });
    fireEvent.change(screen.getByLabelText("Default cooperative deduction per cutoff (PHP)"), { target: { value: "75" } });
    fireEvent.click(screen.getByRole("button", { name: "Save version" }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ kind: "cooperative_policy", data: expect.objectContaining({ deduction_centavos: 7500, reason: "Approved cutoff contribution" }) }));
  });
  it("preserves a fixed employee request in a new deduction version", async () => {
    const source: PayrollRecord = { id: "10000000-0000-4000-8000-000000000002", kind: "deduction", data: { label: "Employee 100 request", reason: "Request", employee_id: "10000000-0000-4000-8000-000000000001", employee_label: "000001 - Dela Cruz, Juan", effective_from: "2026-01-01", deduction_type: "cooperative", deduction_mode: "fixed", deduction_centavos: 10000 }, created_at: "2026-01-01", updated_at: "2026-01-01", created_by: "admin", deleted_at: null };
    const { save } = setup("deduction", source);
    expect(screen.getByLabelText("Deduction per cutoff (PHP)")).toHaveValue(100);
    fireEvent.change(screen.getByLabelText("Change reason"), { target: { value: "Renewed employee request" } });
    fireEvent.click(screen.getByRole("button", { name: "Save version" }));
    await waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({ kind: "deduction", data: expect.objectContaining({ deduction_mode: "fixed", deduction_centavos: 10000 }) })));
    expect(source.data.reason).toBe("Request");
  });
});
