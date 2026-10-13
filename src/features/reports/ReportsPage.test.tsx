import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ReportsPage } from "./ReportsPage";

const mocks = vi.hoisted(() => ({ load: vi.fn() }));
vi.mock("../../services/access/useAccess", () => ({ useAccess: () => ({ can: () => true, profile: { userId: "admin", displayName: "Admin", role: "custom", scopeType: "organization", branchIds: [], effectivePermissions: ["reports.view", "members.view", "employees.view", "payments.view"] } }) }));
vi.mock("../../services/organization/useOrganization", () => ({ useOrganization: () => ({ branches: [], clients: [], departments: [] }) }));
vi.mock("../../services/repositories/reportRepositoryFactory", () => ({ createReportRepository: () => ({ listPage: mocks.load }) }));
vi.mock("../../components/layout/WorkspaceNavigation", () => ({ useWorkspacePath: () => {}, WorkspaceBreadcrumbs: () => null }));
vi.mock("../../components/forms/PlacementSelectors", () => ({ PlacementSelectors: () => null }));

beforeEach(() => {
  mocks.load.mockReset().mockResolvedValue({ items: [{ id: "branch:A", level: "branch", branch: "Alpha", client: "Branch total", members: 1, paid: 0, unpaid: 0, overpaid: 1, amountCentavos: 1215000, refundCentavos: 540000, netPaidCentavos: 675000, overpaidAmountCentavos: 675000, overpaidCentavos: 125000, balanceCentavos: 0 }], total: 1, records: 1, active: 0, pending: 0, attention: 0, paid: 0, unpaid: 0, overpaid: 1, amountCentavos: 1215000, refundCentavos: 540000, netPaidCentavos: 675000, overpaidCentavos: 125000, balanceCentavos: 0 });
});

describe("amounts report workspace", () => {
  it("shows refund-adjusted overpayment separately from outstanding", async () => {
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><ReportsPage /></QueryClientProvider>);
    fireEvent.click(screen.getByRole("button", { name: /^Amounts$/ }));
    await waitFor(() => expect(screen.getByText("Remaining overpayment", { selector: "p" }).nextElementSibling).toHaveTextContent("₱1,250.00"));
    expect(screen.getByText("Total payments", { selector: "p" }).nextElementSibling).toHaveTextContent("₱6,750.00");
    expect(screen.getByText("Gross payments", { selector: "p" }).nextElementSibling).toHaveTextContent("₱12,150.00");
    expect(screen.getByText("Refunds", { selector: "p" }).nextElementSibling).toHaveTextContent("₱5,400.00");
    expect(screen.getByText("Outstanding", { selector: "p" }).nextElementSibling).toHaveTextContent("₱0.00");
    expect(screen.getByText("Remaining overpayment", { selector: "p" }).nextElementSibling).toHaveClass("text-red-700");
    fireEvent.click(screen.getByRole("button", { name: "Report filters" }));
    fireEvent.click(screen.getByRole("combobox", { name: "Payment status" }));
    fireEvent.click(screen.getByRole("option", { name: "Overpaid members" }));
    await waitFor(() => expect(mocks.load).toHaveBeenLastCalledWith(expect.objectContaining({ kind: "amounts", paymentStatus: "overpaid" }), expect.anything()));
  });
});
