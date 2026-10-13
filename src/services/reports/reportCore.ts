import { assertPermission, hasPermission, type AccessProfile } from "../access/accessControl";
import type { ReportKind, ReportPage, ReportQuery, ReportRow, ReportSort } from "../repositories/ReportRepository";
import { memberStatuses, memberTypes } from "../../features/members/data/memberOptions";
import { employmentStatuses, employmentTypes } from "../../features/employees/data/employeeOptions";
import { formatPesos } from "../payments/paymentMath";

export const reportTitles: Record<ReportKind, string> = { members: "Membership register", employees: "Workforce register", deployment: "Deployment by branch / client", amounts: "Member payments by branch / client" };
export const emptyReport: ReportPage = { items: [], total: 0, records: 0, active: 0, pending: 0, attention: 0 };
export function reportModule(kind: ReportKind) { return kind === "members" || kind === "amounts" ? "members" : "employees"; }
export function canViewReport(profile: AccessProfile, kind: ReportKind) { return hasPermission(profile, "reports.view") && hasPermission(profile, `${reportModule(kind)}.view`) && (kind !== "amounts" || hasPermission(profile, "payments.view") && hasPermission(profile, "employees.view")); }
export function canExportReport(profile: AccessProfile, kind: ReportKind) { return canViewReport(profile, kind) && hasPermission(profile, "reports.export") && hasPermission(profile, `${reportModule(kind)}.export`) && (kind !== "amounts" || hasPermission(profile, "payments.export")); }
export function assertReportAccess(profile: AccessProfile, query: ReportQuery) {
  assertPermission(profile, "reports.view"); assertPermission(profile, `${reportModule(query.kind)}.view`);
  if (query.kind === "amounts") { assertPermission(profile, "payments.view"); assertPermission(profile, "employees.view"); }
  if (query.exporting) { assertPermission(profile, "reports.export"); assertPermission(profile, `${reportModule(query.kind)}.export`); }
  if (query.exporting && query.kind === "amounts") assertPermission(profile, "payments.export");
}
export const reportSortKeys: ReportSort[] = ["number", "name", "branch", "client", "department", "position", "statusId", "typeId", "date", "approval", "attention", "employees", "active", "direct", "clientDeployed", "members", "paid", "unpaid", "amountCentavos", "paidAmountCentavos", "unpaidAmountCentavos", "overpaidAmountCentavos", "netPaidCentavos", "refundCentavos", "overpaidCentavos", "overpaid", "balanceCentavos"];
export function validateReportQuery(query: ReportQuery): ReportQuery {
  if (!["members", "employees", "deployment", "amounts"].includes(query.kind)) throw new Error("Unknown report.");
  if (query.paymentStatus && !["paid", "unpaid", "overpaid"].includes(query.paymentStatus)) throw new Error("Unknown payment status.");
  for (const value of [query.dateFrom, query.dateTo]) if (value && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value)) throw new Error("Enter a valid report date.");
  if (query.dateFrom && query.dateTo && query.dateFrom > query.dateTo) throw new Error("The end date must not precede the start date.");
  if (query.sort && !reportSortKeys.includes(query.sort)) throw new Error("Unknown sort column.");
  const limit = Number.isFinite(query.limit) ? Math.min(500, Math.max(1, Math.trunc(query.limit!))) : 25;
  const offset = Number.isFinite(query.offset) ? Math.max(0, Math.trunc(query.offset!)) : 0;
  return { ...query, search: query.search?.trim().slice(0, 200), limit, offset, direction: query.direction === "desc" ? "desc" : "asc" };
}
export function reportCell(row: ReportRow, key: ReportSort, kind: ReportKind): string {
  if (key.endsWith("Centavos")) return formatPesos(Number(row[key] ?? 0));
  if (key === "statusId") return (kind === "members" ? memberStatuses : employmentStatuses).find((item) => item.id === row.statusId)?.label || "Not set";
  if (key === "typeId") return (kind === "members" ? memberTypes : employmentTypes).find((item) => item.id === row.typeId)?.label || "Not set";
  if (key === "attention") return row.attention ? "Needs attention" : "Reviewed";
  if (key === "approval") return row.approval === "approved" ? "Approved" : row.approval === "pending" ? "Pending" : "-";
  return String(row[key] ?? "");
}
export function reportColumns(kind: ReportKind): Array<{ key: ReportSort; label: string; numeric?: boolean; currency?: boolean }> {
  if (kind === "amounts") return [{ key: "branch", label: "Branch" }, { key: "client", label: "Client" }, { key: "members", label: "Members", numeric: true }, { key: "paid", label: "Paid members", numeric: true }, { key: "unpaid", label: "Unpaid members", numeric: true }, { key: "overpaid", label: "Overpaid members", numeric: true }, { key: "overpaidCentavos", label: "Remaining overpayment", numeric: true, currency: true }, { key: "netPaidCentavos", label: "Total payments", numeric: true, currency: true }, { key: "amountCentavos", label: "Gross payments", numeric: true, currency: true }, { key: "refundCentavos", label: "Refunds", numeric: true, currency: true }, { key: "paidAmountCentavos", label: "Paid members net", numeric: true, currency: true }, { key: "unpaidAmountCentavos", label: "Unpaid members net", numeric: true, currency: true }, { key: "overpaidAmountCentavos", label: "Overpaid members net", numeric: true, currency: true }, { key: "balanceCentavos", label: "Outstanding", numeric: true, currency: true }];
  if (kind === "deployment") return [{ key: "branch", label: "Branch" }, { key: "client", label: "Client" }, { key: "employees", label: "Employees", numeric: true }, { key: "active", label: "Active", numeric: true }, { key: "direct", label: "Direct", numeric: true }, { key: "clientDeployed", label: "Client deployed", numeric: true }, { key: "attention", label: "Review" }];
  return [{ key: "number", label: "ID" }, { key: "name", label: "Name" }, { key: "branch", label: "Branch" }, { key: "client", label: "Client" }, ...(kind === "employees" ? [{ key: "department" as const, label: "Department" }, { key: "position" as const, label: "Position" }] : []), { key: "statusId", label: "Status" }, { key: "typeId", label: "Type" }, { key: "date", label: kind === "members" ? "Joined" : "Hired" }, ...(kind === "members" ? [{ key: "approval" as const, label: "BOD approval" }] : []), { key: "attention", label: "Review" }];
}

export async function collectReportRows(load: (query: ReportQuery) => Promise<ReportPage>, query: ReportQuery, onProgress?: (count: number) => void) {
  const rows: ReportRow[] = [];
  for (let offset = 0; ; offset += 500) {
    const page = await load({ ...query, exporting: true, limit: 500, offset });
    if (page.total > 50000) throw new Error("This export exceeds 50,000 rows. Narrow the branch, client or date filters.");
    rows.push(...page.items); onProgress?.(rows.length);
    if (!page.items.length || rows.length >= page.total) return rows;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}
