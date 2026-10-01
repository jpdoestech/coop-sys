import type { BaseRecord } from "./common";

export type PaymentSettings = {
  id: string;
  membership_fee_centavos: number;
  capital_share_target_centavos: number;
  effective_from: string;
  effective_to: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type MemberAlias = BaseRecord & {
  employee_id: string;
  client_id: string;
  alias: string;
  normalized_alias: string;
};

export type PaymentMethod = "manual" | "payroll_deduction";

export type PaymentBatch = BaseRecord & {
  branch_id: string;
  client_id: string | null;
  method: PaymentMethod;
  cutoff_from: string | null;
  cutoff_to: string | null;
  payroll_month: number | null;
  payment_date: string;
  source_file_name: string | null;
  remarks: string | null;
  created_by: string;
};

export type MemberPayment = BaseRecord & {
  batch_id: string;
  employee_id: string;
  member_id: string;
  amount_centavos: number;
  membership_fee_centavos: number;
  capital_share_centavos: number;
  payment_date: string;
  method: PaymentMethod;
  remarks: string | null;
};

export type FinalPaySettlement = BaseRecord & {
  employee_id: string;
  member_id: string;
  capital_share_refund_centavos: number;
  membership_fee_refund_centavos: number;
  refund_membership_fee: boolean;
  settlement_date: string;
  remarks: string | null;
  created_by: string;
};

export type PaymentLedger = {
  settings: PaymentSettings[];
  aliases: MemberAlias[];
  batches: PaymentBatch[];
  payments: MemberPayment[];
  settlements: FinalPaySettlement[];
  paymentTotal: number;
};

export type PaymentImportRow = {
  rowNumber: number;
  id: string;
  name: string;
  amountCentavos: number;
  remarks: string;
};

export type PaymentImportMatch = PaymentImportRow & {
  employeeId: string | null;
  memberId: string | null;
  matchedBy: "id" | "name" | "alias" | null;
  confidence: number;
  suggestedEmployeeId: string | null;
  error: string | null;
};
