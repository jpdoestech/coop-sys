import type {
  FinalPaySettlement,
  MemberAlias,
  MemberPayment,
  OverDeductionRefund,
  PaymentBatch,
  PaymentCorrection,
  PaymentLedger,
  PaymentSettings,
} from "../../types/payment";

export type PaymentBatchInput = Pick<
  PaymentBatch,
  | "branch_id"
  | "client_id"
  | "method"
  | "cutoff_from"
  | "cutoff_to"
  | "payroll_month"
  | "payment_date"
  | "source_file_name"
  | "remarks"
  | "created_by"
>;
export type PaymentLineInput = {
  employee_id: string;
  member_id: string;
  amount_centavos: number;
  remarks: string | null;
};
export type PaymentSettingsInput = Pick<
  PaymentSettings,
  "membership_fee_centavos" | "capital_share_target_centavos" | "effective_from"
>;
export type AliasInput = Pick<
  MemberAlias,
  "employee_id" | "client_id" | "alias" | "normalized_alias"
> & { id?: string };
export type SettlementInput = Pick<
  FinalPaySettlement,
  | "employee_id"
  | "member_id"
  | "refund_membership_fee"
  | "settlement_date"
  | "remarks"
  | "created_by"
>;
export type RefundInput = Pick<
  OverDeductionRefund,
  | "employee_id"
  | "member_id"
  | "branch_id"
  | "client_id"
  | "amount_centavos"
  | "refund_date"
  | "cutoff_from"
  | "cutoff_to"
  | "method"
  | "source_file_name"
  | "remarks"
  | "created_by"
> & { id?: string };
export type PaymentCorrectionInput = {
  payment_id: string;
  amount_centavos: number;
  remarks: string | null;
  comment: string;
  corrected_by: string;
};
export type PaymentSortKey =
  | "date"
  | "employee"
  | "placement"
  | "year"
  | "period"
  | "method"
  | "fee"
  | "capital"
  | "total";
export type PaymentQueryOptions = {
  limit?: number;
  offset?: number;
  employeeIds?: string[];
  yearFrom?: number;
  yearTo?: number;
  branchIds?: string[];
  clientIds?: string[];
  sortBy?: PaymentSortKey;
  sortDirection?: "asc" | "desc";
};
export type PaymentSummarySortKey =
  | "date"
  | "employee"
  | "placement"
  | "first"
  | "last"
  | "fee"
  | "capital"
  | "balance"
  | "status";
export type PaymentSummaryQueryOptions = {
  search?: string;
  yearFrom: number;
  yearTo: number;
  period?: PaymentPeriodFilter;
  branchIds?: string[];
  clientIds?: string[];
  sortBy?: PaymentSummarySortKey;
  sortDirection?: "asc" | "desc";
  limit?: number;
  offset?: number;
};
export type PaymentPeriodFilter =
  | { kind: "cutoff"; cutoffFrom: string; cutoffTo: string; label: string }
  | { kind: "date"; paymentDate: string; label: string };
export type PaymentSummaryItem = {
  employeeId: string;
  employeeNumber: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  suffix: string | null;
  branchId: string | null;
  branchLabel: string | null;
  clientId: string | null;
  clientLabel: string | null;
  firstPayment: string | null;
  lastPayment: string | null;
  membershipFeeCentavos: number;
  capitalShareCentavos: number;
  totalPaidCentavos: number;
  totalBalanceCentavos: number;
  status: "Paid" | "Unpaid";
};
export type PaymentSummaryPage = { items: PaymentSummaryItem[]; total: number };
export type RefundQueryOptions = {
  employeeIds?: string[];
  branchIds?: string[];
  clientIds?: string[];
  limit?: number;
  offset?: number;
};
export type RefundPage = { items: OverDeductionRefund[]; total: number };

export interface PaymentRepository {
  getLedger(options?: PaymentQueryOptions): Promise<PaymentLedger>;
  getPaymentSummary(
    options: PaymentSummaryQueryOptions,
  ): Promise<PaymentSummaryPage>;
  getRefundPage(options?: RefundQueryOptions): Promise<RefundPage>;
  saveSettings(input: PaymentSettingsInput): Promise<PaymentSettings>;
  saveAlias(input: AliasInput): Promise<MemberAlias>;
  archiveAlias(id: string): Promise<void>;
  postBatch(
    batch: PaymentBatchInput,
    lines: PaymentLineInput[],
  ): Promise<{ batch: PaymentBatch; payments: MemberPayment[] }>;
  correctPayment(
    input: PaymentCorrectionInput,
  ): Promise<{ payment: MemberPayment; correction: PaymentCorrection }>;
  saveRefund(input: RefundInput): Promise<OverDeductionRefund>;
  settleFinalPay(input: SettlementInput): Promise<FinalPaySettlement>;
}
