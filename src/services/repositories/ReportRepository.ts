import type { AccessProfile } from "../access/accessControl";

export type ReportKind = "members" | "employees" | "deployment" | "amounts";
export type ReportRow = {
  id: string; number: string; name: string; branchId: string; clientId: string;
  branch: string; client: string; department: string; position: string;
  statusId: string; typeId: string; date: string; approval: string; attention: boolean;
  employees: number; active: number; direct: number; clientDeployed: number;
  level?: "branch" | "client";
  members?: number; paid?: number; unpaid?: number; overpaid?: number;
  amountCentavos?: number; paidAmountCentavos?: number; unpaidAmountCentavos?: number; overpaidAmountCentavos?: number; netPaidCentavos?: number; balanceCentavos?: number;
  membershipFeeCentavos?: number; capitalShareCentavos?: number; refundCentavos?: number; retainedCapitalShareCentavos?: number; overpaidCentavos?: number;
};
export type ReportSort = keyof Pick<ReportRow, "number" | "name" | "branch" | "client" | "department" | "position" | "statusId" | "typeId" | "date" | "approval" | "attention" | "employees" | "active" | "direct" | "clientDeployed" | "members" | "paid" | "unpaid" | "amountCentavos" | "paidAmountCentavos" | "unpaidAmountCentavos" | "overpaidAmountCentavos" | "netPaidCentavos" | "refundCentavos" | "overpaidCentavos" | "overpaid" | "balanceCentavos">;
export type ReportFilters = { search?: string; branchId?: string; clientId?: string; statusId?: string; typeId?: string; departmentId?: string; dateFrom?: string; dateTo?: string; approval?: string; attentionOnly?: boolean; paymentStatus?: "paid" | "unpaid" | "overpaid" };
export type ReportQuery = ReportFilters & { kind: ReportKind; sort?: ReportSort; direction?: "asc" | "desc"; limit?: number; offset?: number; exporting?: boolean };
export type ReportPage = { items: ReportRow[]; total: number; records: number; active: number; pending: number; attention: number; paid?: number; unpaid?: number; overpaid?: number; amountCentavos?: number; refundCentavos?: number; netPaidCentavos?: number; overpaidCentavos?: number; balanceCentavos?: number };
export interface ReportRepository { listPage(query: ReportQuery, profile: AccessProfile): Promise<ReportPage> }
