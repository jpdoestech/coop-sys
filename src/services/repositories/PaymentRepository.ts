import type { FinalPaySettlement, MemberAlias, MemberPayment, PaymentBatch, PaymentLedger, PaymentSettings } from "../../types/payment";

export type PaymentBatchInput = Pick<PaymentBatch, "branch_id" | "client_id" | "method" | "cutoff_from" | "cutoff_to" | "payroll_month" | "payment_date" | "source_file_name" | "remarks" | "created_by">;
export type PaymentLineInput = { employee_id: string; member_id: string; amount_centavos: number; remarks: string | null };
export type PaymentSettingsInput = Pick<PaymentSettings, "membership_fee_centavos" | "capital_share_target_centavos" | "effective_from">;
export type AliasInput = Pick<MemberAlias, "employee_id" | "client_id" | "alias" | "normalized_alias">;
export type SettlementInput = Pick<FinalPaySettlement, "employee_id" | "member_id" | "refund_membership_fee" | "settlement_date" | "remarks" | "created_by">;

export interface PaymentRepository {
  getLedger(options?: { limit?: number; offset?: number; employeeIds?: string[] }): Promise<PaymentLedger>;
  saveSettings(input: PaymentSettingsInput): Promise<PaymentSettings>;
  saveAlias(input: AliasInput): Promise<MemberAlias>;
  postBatch(batch: PaymentBatchInput, lines: PaymentLineInput[]): Promise<{ batch: PaymentBatch; payments: MemberPayment[] }>;
  settleFinalPay(input: SettlementInput): Promise<FinalPaySettlement>;
}
