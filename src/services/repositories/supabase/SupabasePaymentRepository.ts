import { supabase } from "../../../database/supabase/client";
import type { PaymentLedger, PaymentSettings } from "../../../types/payment";
import { allocatePayment, effectiveSettings } from "../../payments/paymentMath";
import type { AliasInput, PaymentBatchInput, PaymentLineInput, PaymentRepository, PaymentSettingsInput, SettlementInput } from "../PaymentRepository";

function db() { if (!supabase) throw new Error("Supabase is not configured."); return supabase; }

export class SupabasePaymentRepository implements PaymentRepository {
  async getLedger(options: { limit?: number; offset?: number; employeeIds?: string[] } = {}): Promise<PaymentLedger> {
    const client = db();
    let paymentQuery = client.from("member_payments").select("*", { count: "exact" }).is("deleted_at", null).order("payment_date", { ascending: false });
    if (options.employeeIds) paymentQuery = options.employeeIds.length ? paymentQuery.in("employee_id", options.employeeIds) : paymentQuery.eq("employee_id", "00000000-0000-4000-8000-000000000000");
    if (options.limit) paymentQuery = paymentQuery.range(options.offset ?? 0, (options.offset ?? 0) + options.limit - 1);
    const [settings, aliases, batches, payments, settlements] = await Promise.all([
      client.from("payment_settings").select("*").order("effective_from", { ascending: false }),
      client.from("member_aliases").select("*").is("deleted_at", null),
      client.from("payment_batches").select("*").is("deleted_at", null).order("created_at", { ascending: false }),
      paymentQuery,
      client.from("final_pay_settlements").select("*").is("deleted_at", null).order("settlement_date", { ascending: false }),
    ]);
    const error = settings.error ?? aliases.error ?? batches.error ?? payments.error ?? settlements.error;
    if (error) throw error;
    return { settings: settings.data ?? [], aliases: aliases.data ?? [], batches: batches.data ?? [], payments: payments.data ?? [], settlements: settlements.data ?? [], paymentTotal: payments.count ?? 0 } as PaymentLedger;
  }

  async saveSettings(input: PaymentSettingsInput) {
    const client = db();
    const previousDay = new Date(new Date(`${input.effective_from}T00:00:00`).getTime() - 86400000).toISOString().slice(0, 10);
    const { error: closeError } = await client.from("payment_settings").update({ is_active: false, effective_to: previousDay, updated_at: new Date().toISOString() }).eq("is_active", true).lt("effective_from", input.effective_from);
    if (closeError) throw closeError;
    const { data, error } = await client.from("payment_settings").insert({ ...input, is_active: true }).select("*").single();
    if (error) throw error;
    return data as PaymentSettings;
  }

  async saveAlias(input: AliasInput) {
    const { data, error } = await db().from("member_aliases").insert({ ...input, sync_status: "synced" }).select("*").single();
    if (error) throw error;
    return data;
  }

  async postBatch(input: PaymentBatchInput, lines: PaymentLineInput[]) {
    const client = db();
    const ledger = await this.getLedger();
    const settings = effectiveSettings(ledger.settings, input.payment_date);
    if (!settings) throw new Error("No payment settings are effective for the payment date.");
    const { data: batch, error: batchError } = await client.from("payment_batches").insert({ ...input, sync_status: "synced" }).select("*").single();
    if (batchError) throw batchError;
    const runningPayments = [...ledger.payments];
    const rows = lines.map((line) => {
      const allocation = allocatePayment(line.amount_centavos, settings, runningPayments.filter((payment) => payment.member_id === line.member_id));
      const payment = { batch_id: batch.id, employee_id: line.employee_id, member_id: line.member_id, amount_centavos: line.amount_centavos, membership_fee_centavos: allocation.membershipFeeCentavos, capital_share_centavos: allocation.capitalShareCentavos, payment_date: input.payment_date, method: input.method, remarks: line.remarks, sync_status: "synced" as const };
      runningPayments.push({ ...payment, id: crypto.randomUUID(), created_at: "", updated_at: "", deleted_at: null });
      return payment;
    });
    const { data: payments, error } = await client.from("member_payments").insert(rows).select("*");
    if (error) throw error;
    return { batch, payments: payments ?? [] };
  }

  async settleFinalPay(input: SettlementInput) {
    const ledger = await this.getLedger();
    const payments = ledger.payments.filter((payment) => payment.member_id === input.member_id);
    const { data, error } = await db().from("final_pay_settlements").insert({ ...input, capital_share_refund_centavos: payments.reduce((sum, item) => sum + item.capital_share_centavos, 0), membership_fee_refund_centavos: input.refund_membership_fee ? payments.reduce((sum, item) => sum + item.membership_fee_centavos, 0) : 0, sync_status: "synced" }).select("*").single();
    if (error) throw error;
    return data;
  }
}
