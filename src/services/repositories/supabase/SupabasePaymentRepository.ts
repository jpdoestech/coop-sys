import { supabase } from "../../../database/supabase/client";
import type {
  MemberPayment,
  PaymentLedger,
  PaymentSettings,
} from "../../../types/payment";
import { allocatePayment, effectiveSettings } from "../../payments/paymentMath";
import type {
  AliasInput,
  PaymentBatchInput,
  PaymentCorrectionInput,
  PaymentLineInput,
  PaymentQueryOptions,
  PaymentRepository,
  PaymentSettingsInput,
  PaymentSummaryItem,
  PaymentSummaryQueryOptions,
  RefundInput,
  RefundQueryOptions,
  SettlementInput,
} from "../PaymentRepository";

function db() {
  if (!supabase) throw new Error("Supabase is not configured.");
  return supabase;
}

export class SupabasePaymentRepository implements PaymentRepository {
  async getRefundPage(options: RefundQueryOptions = {}) {
    let query = db()
      .from("over_deduction_refunds")
      .select("*", { count: "exact" })
      .is("deleted_at", null)
      .order("refund_date", { ascending: false });
    if (options.employeeIds)
      query = options.employeeIds.length
        ? query.in("employee_id", options.employeeIds)
        : query.eq("employee_id", "00000000-0000-4000-8000-000000000000");
    if (options.branchIds)
      query = options.branchIds.length
        ? query.in("branch_id", options.branchIds)
        : query.eq("branch_id", "00000000-0000-4000-8000-000000000000");
    if (options.clientIds)
      query = options.clientIds.length
        ? query.in("client_id", options.clientIds)
        : query.eq("client_id", "00000000-0000-4000-8000-000000000000");
    if (options.limit)
      query = query.range(
        options.offset ?? 0,
        (options.offset ?? 0) + options.limit - 1,
      );
    const { data, error, count } = await query;
    if (error) throw error;
    return { items: data ?? [], total: count ?? 0 };
  }

  async getPaymentSummary(options: PaymentSummaryQueryOptions) {
    const { data, error } = await db().rpc("payment_summary_page", {
      p_search_term: options.search?.trim() || null,
      p_year_from: options.yearFrom,
      p_year_to: options.yearTo,
      p_branch_ids: options.branchIds ?? null,
      p_client_ids: options.clientIds ?? null,
      p_sort_key: options.sortBy ?? "employee",
      p_sort_direction: options.sortDirection ?? "asc",
      p_page_limit: options.limit ?? null,
      p_page_offset: options.offset ?? 0,
    });
    if (error) throw error;
    const rows = (data ?? []) as Array<Record<string, unknown>>;
    return {
      items: rows.map(
        (row): PaymentSummaryItem => ({
          employeeId: String(row.employee_id),
          employeeNumber: String(row.employee_number),
          firstName: String(row.first_name),
          middleName: row.middle_name ? String(row.middle_name) : null,
          lastName: String(row.last_name),
          suffix: row.suffix ? String(row.suffix) : null,
          branchId: row.branch_id ? String(row.branch_id) : null,
          branchLabel: row.branch_label ? String(row.branch_label) : null,
          clientId: row.client_id ? String(row.client_id) : null,
          clientLabel: row.client_label ? String(row.client_label) : null,
          firstPayment: row.first_payment ? String(row.first_payment) : null,
          lastPayment: row.last_payment ? String(row.last_payment) : null,
          membershipFeeCentavos: Number(row.membership_fee_centavos),
          capitalShareCentavos: Number(row.capital_share_centavos),
          totalPaidCentavos: Number(row.total_paid_centavos),
          totalBalanceCentavos: Number(row.total_balance_centavos),
          status: row.payment_status === "Paid" ? "Paid" : "Unpaid",
        }),
      ),
      total: Number(rows[0]?.total_count ?? 0),
    };
  }

  async getLedger(options: PaymentQueryOptions = {}): Promise<PaymentLedger> {
    const client = db();
    let batchQuery = client
      .from("payment_batches")
      .select("*")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (options.branchIds)
      batchQuery = options.branchIds.length
        ? batchQuery.in("branch_id", options.branchIds)
        : batchQuery.eq("branch_id", "00000000-0000-4000-8000-000000000000");
    if (options.clientIds)
      batchQuery = options.clientIds.length
        ? batchQuery.in("client_id", options.clientIds)
        : batchQuery.eq("client_id", "00000000-0000-4000-8000-000000000000");
    const batches = await batchQuery;
    if (batches.error) throw batches.error;
    const filterByBatch = Boolean(options.branchIds || options.clientIds);
    const batchIds = (batches.data ?? []).map((batch) => batch.id as string);
    const sortColumn =
      options.sortBy === "employee"
        ? "employee_id"
        : options.sortBy === "placement"
          ? "batch_id"
          : options.sortBy === "method"
            ? "method"
            : options.sortBy === "fee"
              ? "membership_fee_centavos"
              : options.sortBy === "capital"
                ? "capital_share_centavos"
                : options.sortBy === "total"
                  ? "amount_centavos"
                  : "payment_date";
    let paymentQuery = client
      .from("member_payments")
      .select("*", { count: "exact" })
      .is("deleted_at", null)
      .order(sortColumn, { ascending: options.sortDirection === "asc" });
    if (options.employeeIds)
      paymentQuery = options.employeeIds.length
        ? paymentQuery.in("employee_id", options.employeeIds)
        : paymentQuery.eq(
            "employee_id",
            "00000000-0000-4000-8000-000000000000",
          );
    if (filterByBatch)
      paymentQuery = batchIds.length
        ? paymentQuery.in("batch_id", batchIds)
        : paymentQuery.eq("batch_id", "00000000-0000-4000-8000-000000000000");
    if (options.yearFrom)
      paymentQuery = paymentQuery.gte(
        "payment_date",
        `${options.yearFrom}-01-01`,
      );
    if (options.yearTo)
      paymentQuery = paymentQuery.lte(
        "payment_date",
        `${options.yearTo}-12-31`,
      );
    if (options.limit)
      paymentQuery = paymentQuery.range(
        options.offset ?? 0,
        (options.offset ?? 0) + options.limit - 1,
      );
    let refundsQuery = client
      .from("over_deduction_refunds")
      .select("*", { count: "exact" })
      .is("deleted_at", null)
      .order("refund_date", { ascending: false });
    if (options.employeeIds)
      refundsQuery = options.employeeIds.length
        ? refundsQuery.in("employee_id", options.employeeIds)
        : refundsQuery.eq(
            "employee_id",
            "00000000-0000-4000-8000-000000000000",
          );
    if (options.branchIds)
      refundsQuery = options.branchIds.length
        ? refundsQuery.in("branch_id", options.branchIds)
        : refundsQuery.eq("branch_id", "00000000-0000-4000-8000-000000000000");
    if (options.clientIds)
      refundsQuery = options.clientIds.length
        ? refundsQuery.in("client_id", options.clientIds)
        : refundsQuery.eq("client_id", "00000000-0000-4000-8000-000000000000");
    const [settings, aliases, payments, settlements, corrections, refunds] =
      await Promise.all([
        client
          .from("payment_settings")
          .select("*")
          .order("effective_from", { ascending: false }),
        client.from("member_aliases").select("*").is("deleted_at", null),
        paymentQuery,
        client
          .from("final_pay_settlements")
          .select("*")
          .is("deleted_at", null)
          .order("settlement_date", { ascending: false }),
        client
          .from("payment_corrections")
          .select("*")
          .is("deleted_at", null)
          .order("created_at", { ascending: false }),
        refundsQuery,
      ]);
    const error =
      settings.error ??
      aliases.error ??
      payments.error ??
      settlements.error ??
      corrections.error ??
      refunds.error;
    if (error) throw error;
    return {
      settings: settings.data ?? [],
      aliases: aliases.data ?? [],
      batches: batches.data ?? [],
      payments: payments.data ?? [],
      settlements: settlements.data ?? [],
      corrections: corrections.data ?? [],
      refunds: refunds.data ?? [],
      paymentTotal: payments.count ?? 0,
      refundTotal: refunds.count ?? 0,
    } as PaymentLedger;
  }

  async saveSettings(input: PaymentSettingsInput) {
    const client = db();
    const previousDay = new Date(
      new Date(`${input.effective_from}T00:00:00`).getTime() - 86400000,
    )
      .toISOString()
      .slice(0, 10);
    const { error: closeError } = await client
      .from("payment_settings")
      .update({
        is_active: false,
        effective_to: previousDay,
        updated_at: new Date().toISOString(),
      })
      .eq("is_active", true)
      .lt("effective_from", input.effective_from);
    if (closeError) throw closeError;
    const { data, error } = await client
      .from("payment_settings")
      .insert({ ...input, is_active: true })
      .select("*")
      .single();
    if (error) throw error;
    return data as PaymentSettings;
  }

  async saveAlias(input: AliasInput) {
    const { id, ...fields } = input;
    if (!id) {
      const { data: existing, error: existingError } = await db()
        .from("member_aliases")
        .select("*")
        .eq("client_id", fields.client_id)
        .eq("normalized_alias", fields.normalized_alias)
        .is("deleted_at", null)
        .maybeSingle();
      if (existingError) throw existingError;
      if (existing) {
        if (existing.employee_id !== fields.employee_id)
          throw new Error(
            "This alias already belongs to another employee for the selected client.",
          );
        return existing;
      }
    }
    const query = id
      ? db()
          .from("member_aliases")
          .update({
            ...fields,
            updated_at: new Date().toISOString(),
            sync_status: "synced",
          })
          .eq("id", id)
      : db()
          .from("member_aliases")
          .insert({ ...fields, sync_status: "synced" });
    const { data, error } = await query.select("*").single();
    if (error) throw error;
    return data;
  }

  async archiveAlias(id: string) {
    const { error } = await db()
      .from("member_aliases")
      .update({
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        sync_status: "synced",
      })
      .eq("id", id);
    if (error) throw error;
  }

  async postBatch(input: PaymentBatchInput, lines: PaymentLineInput[]) {
    const client = db();
    const ledger = await this.getLedger();
    const settings = effectiveSettings(ledger.settings, input.payment_date);
    if (!settings)
      throw new Error(
        "No payment settings are effective for the payment date.",
      );
    const { data: batch, error: batchError } = await client
      .from("payment_batches")
      .insert({ ...input, sync_status: "synced" })
      .select("*")
      .single();
    if (batchError) throw batchError;
    const runningPayments = [...ledger.payments];
    const rows = lines.map((line) => {
      const allocation = allocatePayment(
        line.amount_centavos,
        settings,
        runningPayments.filter(
          (payment) => payment.member_id === line.member_id,
        ),
      );
      const payment = {
        batch_id: batch.id,
        employee_id: line.employee_id,
        member_id: line.member_id,
        amount_centavos: line.amount_centavos,
        membership_fee_centavos: allocation.membershipFeeCentavos,
        capital_share_centavos: allocation.capitalShareCentavos,
        payment_date: input.payment_date,
        method: input.method,
        remarks: line.remarks,
        sync_status: "synced" as const,
      };
      runningPayments.push({
        ...payment,
        id: crypto.randomUUID(),
        created_at: "",
        updated_at: "",
        deleted_at: null,
      });
      return payment;
    });
    const { data: payments, error } = await client
      .from("member_payments")
      .insert(rows)
      .select("*");
    if (error) throw error;
    return { batch, payments: payments ?? [] };
  }

  async correctPayment(input: PaymentCorrectionInput) {
    const client = db();
    const ledger = await this.getLedger();
    const original = ledger.payments.find(
      (item) => item.id === input.payment_id,
    );
    if (!original) throw new Error("Payment transaction was not found.");
    if (!input.comment.trim()) throw new Error("Enter a correction comment.");
    const { data: correction, error: correctionError } = await client
      .from("payment_corrections")
      .insert({
        payment_id: original.id,
        from_amount_centavos: original.amount_centavos,
        to_amount_centavos: input.amount_centavos,
        from_remarks: original.remarks,
        to_remarks: input.remarks,
        comment: input.comment.trim(),
        corrected_by: input.corrected_by,
        sync_status: "synced",
      })
      .select("*")
      .single();
    if (correctionError) throw correctionError;
    const memberPayments = ledger.payments
      .filter((item) => item.member_id === original.member_id)
      .map((item) =>
        item.id === original.id
          ? {
              ...item,
              amount_centavos: input.amount_centavos,
              remarks: input.remarks,
            }
          : item,
      )
      .sort(
        (a, b) =>
          a.payment_date.localeCompare(b.payment_date) ||
          a.created_at.localeCompare(b.created_at),
      );
    const running: MemberPayment[] = [];
    let corrected = original;
    for (const payment of memberPayments) {
      const settings = effectiveSettings(ledger.settings, payment.payment_date);
      if (!settings)
        throw new Error(
          `No payment settings apply on ${payment.payment_date}.`,
        );
      const allocation = allocatePayment(
        payment.amount_centavos,
        settings,
        running,
      );
      const { data, error } = await client
        .from("member_payments")
        .update({
          amount_centavos: payment.amount_centavos,
          membership_fee_centavos: allocation.membershipFeeCentavos,
          capital_share_centavos: allocation.capitalShareCentavos,
          remarks: payment.remarks,
          updated_at: new Date().toISOString(),
          sync_status: "synced",
        })
        .eq("id", payment.id)
        .select("*")
        .single();
      if (error) throw error;
      const updated = data as MemberPayment;
      running.push(updated);
      if (payment.id === original.id) corrected = updated;
    }
    return { payment: corrected, correction };
  }

  async saveRefund(input: RefundInput) {
    const { id, ...fields } = input;
    const query = id
      ? db()
          .from("over_deduction_refunds")
          .update({
            ...fields,
            updated_at: new Date().toISOString(),
            sync_status: "synced",
          })
          .eq("id", id)
      : db()
          .from("over_deduction_refunds")
          .insert({ ...fields, sync_status: "synced" });
    const { data, error } = await query.select("*").single();
    if (error) throw error;
    return data;
  }

  async settleFinalPay(input: SettlementInput) {
    const ledger = await this.getLedger();
    const payments = ledger.payments.filter(
      (payment) => payment.member_id === input.member_id,
    );
    const { data, error } = await db()
      .from("final_pay_settlements")
      .insert({
        ...input,
        capital_share_refund_centavos: payments.reduce(
          (sum, item) => sum + item.capital_share_centavos,
          0,
        ),
        membership_fee_refund_centavos: input.refund_membership_fee
          ? payments.reduce(
              (sum, item) => sum + item.membership_fee_centavos,
              0,
            )
          : 0,
        sync_status: "synced",
      })
      .select("*")
      .single();
    if (error) throw error;
    return data;
  }
}
