import type { Employee } from "../../types/employee";
import type { OrganizationBranch, OrganizationClient } from "../../types/organization";
import type { PaymentLedger } from "../../types/payment";
import { effectiveSettings } from "./paymentMath";

export type PaymentSummaryRow = {
  employee: Employee;
  branch: OrganizationBranch | null;
  client: OrganizationClient | null;
  firstPayment: string | null;
  lastPayment: string | null;
  membershipFeeCentavos: number;
  capitalShareCentavos: number;
  totalPaidCentavos: number;
  totalBalanceCentavos: number;
  status: "Paid" | "Unpaid";
};

export function buildPaymentSummary(employees: Employee[], ledger: PaymentLedger, branches: OrganizationBranch[], clients: OrganizationClient[], yearFrom: number, yearTo: number) {
  const settings = effectiveSettings(ledger.settings, `${yearTo}-12-31`);
  const obligation = settings ? settings.membership_fee_centavos + settings.capital_share_target_centavos : 0;
  return employees.filter((employee) => employee.member_id).map((employee): PaymentSummaryRow => {
    const payments = ledger.payments.filter((payment) => payment.employee_id === employee.id && payment.payment_date >= `${yearFrom}-01-01` && payment.payment_date <= `${yearTo}-12-31`).sort((a, b) => a.payment_date.localeCompare(b.payment_date));
    const membershipFeeCentavos = payments.reduce((sum, payment) => sum + payment.membership_fee_centavos, 0);
    const capitalShareCentavos = payments.reduce((sum, payment) => sum + payment.capital_share_centavos, 0);
    const totalPaidCentavos = payments.reduce((sum, payment) => sum + payment.amount_centavos, 0);
    const branch = branches.find((item) => item.id === employee.active_assignment?.branch_id) ?? null;
    const client = clients.find((item) => item.id === employee.active_assignment?.client_id) ?? null;
    const totalBalanceCentavos = Math.max(0, obligation - totalPaidCentavos);
    return { employee, branch, client, firstPayment: payments[0]?.payment_date ?? null, lastPayment: payments.at(-1)?.payment_date ?? null, membershipFeeCentavos, capitalShareCentavos, totalPaidCentavos, totalBalanceCentavos, status: obligation > 0 && totalBalanceCentavos === 0 ? "Paid" : "Unpaid" };
  });
}
