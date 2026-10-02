import type {
  MemberPayment,
  PaymentLedger,
  PaymentSettings,
} from "../../../types/payment";
import { allocatePayment, effectiveSettings } from "../../payments/paymentMath";
import { buildPaymentSummary } from "../../payments/paymentSummary";
import { LocalEmployeeRepository } from "./LocalEmployeeRepository";
import { LocalOrganizationDirectoryRepository } from "./LocalOrganizationDirectoryRepository";
import { createUuid } from "../../../utils/createUuid";
import type {
  AliasInput,
  PaymentBatchInput,
  PaymentCorrectionInput,
  PaymentLineInput,
  PaymentQueryOptions,
  PaymentRepository,
  PaymentSettingsInput,
  PaymentSummaryQueryOptions,
  RefundInput,
  RefundQueryOptions,
  SettlementInput,
} from "../PaymentRepository";
import { flushDatabaseStorage, readPersistentItem, writePersistentItem } from "../../server/databaseStorage";

const STORAGE_KEY = "coop_sys_payment_ledger";
const DEFAULT_SETTINGS: PaymentSettings = {
  id: "default-payment-settings",
  membership_fee_centavos: 50000,
  capital_share_target_centavos: 500000,
  effective_from: "2000-01-01",
  effective_to: null,
  is_active: true,
  created_at: "2000-01-01T00:00:00.000Z",
  updated_at: "2000-01-01T00:00:00.000Z",
};

function emptyLedger(): PaymentLedger {
  return {
    settings: [DEFAULT_SETTINGS],
    aliases: [],
    batches: [],
    payments: [],
    settlements: [],
    corrections: [],
    refunds: [],
    paymentTotal: 0,
    refundTotal: 0,
  };
}

function readLedger(): PaymentLedger {
  const raw = readPersistentItem(STORAGE_KEY);
  if (!raw) return emptyLedger();
  const stored = JSON.parse(raw) as Partial<PaymentLedger>;
  return {
    ...emptyLedger(),
    ...stored,
    settings: stored.settings?.length ? stored.settings : [DEFAULT_SETTINGS],
  };
}

function writeLedger(ledger: PaymentLedger) {
  writePersistentItem(STORAGE_KEY, JSON.stringify(ledger));
}

function recordMeta(timestamp: string) {
  return {
    id: createUuid(),
    created_at: timestamp,
    updated_at: timestamp,
    deleted_at: null,
    sync_status: "pending_create" as const,
  };
}

export class LocalPaymentRepository implements PaymentRepository {
  async getRefundPage(options: RefundQueryOptions = {}) {
    const ledger = readLedger();
    const employeeIds = options.employeeIds
      ? new Set(options.employeeIds)
      : null;
    const branchIds = options.branchIds ? new Set(options.branchIds) : null;
    const clientIds = options.clientIds ? new Set(options.clientIds) : null;
    const records = ledger.refunds
      .filter((item) => !item.deleted_at)
      .filter((item) => !employeeIds || employeeIds.has(item.employee_id))
      .filter((item) => !branchIds || branchIds.has(item.branch_id))
      .filter(
        (item) =>
          !clientIds ||
          Boolean(item.client_id && clientIds.has(item.client_id)),
      )
      .sort((a, b) => b.refund_date.localeCompare(a.refund_date));
    const offset = options.offset ?? 0;
    return {
      items: records.slice(
        offset,
        options.limit ? offset + options.limit : undefined,
      ),
      total: records.length,
    };
  }

  async getPaymentSummary(options: PaymentSummaryQueryOptions) {
    const [employees, directory] = await Promise.all([
      new LocalEmployeeRepository().list(),
      new LocalOrganizationDirectoryRepository().getDirectory(),
    ]);
    const ledger = readLedger();
    const term = options.search?.trim().toLowerCase() ?? "";
    const branchIds = options.branchIds ? new Set(options.branchIds) : null;
    const clientIds = options.clientIds ? new Set(options.clientIds) : null;
    const value = (item: ReturnType<typeof buildPaymentSummary>[number]) =>
      options.sortBy === "placement"
        ? `${item.branch?.label ?? ""}|${item.client?.label ?? ""}`
        : options.sortBy === "first"
          ? (item.firstPayment ?? "")
          : options.sortBy === "last"
            ? (item.lastPayment ?? "")
            : options.sortBy === "fee"
              ? item.membershipFeeCentavos
              : options.sortBy === "capital"
                ? item.capitalShareCentavos
                : options.sortBy === "balance"
                  ? item.totalBalanceCentavos
                  : options.sortBy === "status"
                    ? item.status
                    : `${item.employee.last_name}|${item.employee.first_name}`;
    const records = buildPaymentSummary(
      employees,
      ledger,
      directory.branches,
      directory.clients,
      options.yearFrom,
      options.yearTo,
    )
      .filter((item) => {
        const employeeText = [
          item.employee.employee_number,
          item.employee.first_name,
          item.employee.middle_name,
          item.employee.last_name,
          item.employee.suffix,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return !term || employeeText.includes(term);
      })
      .filter(
        (item) =>
          !branchIds || Boolean(item.branch && branchIds.has(item.branch.id)),
      )
      .filter(
        (item) =>
          !clientIds || Boolean(item.client && clientIds.has(item.client.id)),
      )
      .sort((a, b) => {
        const left = value(a);
        const right = value(b);
        const result =
          typeof left === "number" && typeof right === "number"
            ? left - right
            : String(left).localeCompare(String(right));
        return options.sortDirection === "desc" ? -result : result;
      });
    const offset = options.offset ?? 0;
    const page = options.limit
      ? records.slice(offset, offset + options.limit)
      : records;
    return {
      items: page.map((item) => ({
        employeeId: item.employee.id,
        employeeNumber: item.employee.employee_number,
        firstName: item.employee.first_name,
        middleName: item.employee.middle_name,
        lastName: item.employee.last_name,
        suffix: item.employee.suffix,
        branchId: item.branch?.id ?? null,
        branchLabel: item.branch?.label ?? null,
        clientId: item.client?.id ?? null,
        clientLabel: item.client?.label ?? null,
        firstPayment: item.firstPayment,
        lastPayment: item.lastPayment,
        membershipFeeCentavos: item.membershipFeeCentavos,
        capitalShareCentavos: item.capitalShareCentavos,
        totalPaidCentavos: item.totalPaidCentavos,
        totalBalanceCentavos: item.totalBalanceCentavos,
        status: item.status,
      })),
      total: records.length,
    };
  }

  async getLedger(options: PaymentQueryOptions = {}) {
    const ledger = readLedger();
    const allowed = options.employeeIds ? new Set(options.employeeIds) : null;
    const branchIds = options.branchIds ? new Set(options.branchIds) : null;
    const clientIds = options.clientIds ? new Set(options.clientIds) : null;
    const batches = new Map(ledger.batches.map((batch) => [batch.id, batch]));
    const value = (payment: MemberPayment) => {
      const batch = batches.get(payment.batch_id);
      if (options.sortBy === "employee") return payment.employee_id;
      if (options.sortBy === "placement")
        return `${batch?.branch_id ?? ""}|${batch?.client_id ?? ""}`;
      if (options.sortBy === "method") return payment.method;
      if (options.sortBy === "fee") return payment.membership_fee_centavos;
      if (options.sortBy === "capital") return payment.capital_share_centavos;
      if (options.sortBy === "total") return payment.amount_centavos;
      if (options.sortBy === "period")
        return `${batch?.cutoff_from ?? payment.payment_date}|${batch?.cutoff_to ?? payment.payment_date}`;
      return payment.payment_date;
    };
    const filtered = ledger.payments
      .filter((payment) => !payment.deleted_at)
      .filter((payment) => !allowed || allowed.has(payment.employee_id))
      .filter(
        (payment) =>
          !options.yearFrom ||
          payment.payment_date >= `${options.yearFrom}-01-01`,
      )
      .filter(
        (payment) =>
          !options.yearTo || payment.payment_date <= `${options.yearTo}-12-31`,
      )
      .filter(
        (payment) =>
          !branchIds ||
          Boolean(
            batches.get(payment.batch_id) &&
              branchIds.has(batches.get(payment.batch_id)!.branch_id),
          ),
      )
      .filter(
        (payment) =>
          !clientIds ||
          Boolean(
            batches.get(payment.batch_id)?.client_id &&
              clientIds.has(batches.get(payment.batch_id)!.client_id!),
          ),
      )
      .sort((a, b) => {
        const left = value(a);
        const right = value(b);
        const result =
          typeof left === "number" && typeof right === "number"
            ? left - right
            : String(left).localeCompare(String(right));
        return options.sortDirection === "asc" ? result : -result;
      });
    const paymentTotal = filtered.length;
    const offset = options.offset ?? 0;
    const refunds = ledger.refunds
      .filter((item) => !item.deleted_at)
      .filter((item) => !allowed || allowed.has(item.employee_id))
      .filter((item) => !branchIds || branchIds.has(item.branch_id))
      .filter(
        (item) =>
          !clientIds ||
          Boolean(item.client_id && clientIds.has(item.client_id)),
      );
    return {
      ...ledger,
      payments: options.limit
        ? filtered.slice(offset, offset + options.limit)
        : filtered,
      paymentTotal,
      refunds,
      refundTotal: refunds.length,
    };
  }

  async saveSettings(input: PaymentSettingsInput) {
    const ledger = readLedger();
    const timestamp = new Date().toISOString();
    ledger.settings = ledger.settings.map((setting) =>
      setting.is_active && setting.effective_from < input.effective_from
        ? {
            ...setting,
            is_active: false,
            effective_to: new Date(
              new Date(`${input.effective_from}T00:00:00`).getTime() - 86400000,
            )
              .toISOString()
              .slice(0, 10),
            updated_at: timestamp,
          }
        : setting,
    );
    const settings: PaymentSettings = {
      id: createUuid(),
      ...input,
      effective_to: null,
      is_active: true,
      created_at: timestamp,
      updated_at: timestamp,
    };
    ledger.settings.push(settings);
    writeLedger(ledger);
    await flushDatabaseStorage();
    return settings;
  }

  async saveAlias(input: AliasInput) {
    const ledger = readLedger();
    const duplicate = ledger.aliases.find(
      (alias) =>
        !alias.deleted_at &&
        alias.client_id === input.client_id &&
        alias.normalized_alias === input.normalized_alias &&
        alias.employee_id !== input.employee_id,
    );
    if (duplicate)
      throw new Error(
        "This alias already belongs to another employee for the selected client.",
      );
    const existing = input.id
      ? ledger.aliases.find((alias) => alias.id === input.id)
      : ledger.aliases.find(
          (alias) =>
            !alias.deleted_at &&
            alias.client_id === input.client_id &&
            alias.normalized_alias === input.normalized_alias &&
            alias.employee_id === input.employee_id,
        );
    if (existing) {
      const updated = {
        ...existing,
        ...input,
        id: existing.id,
        updated_at: new Date().toISOString(),
        sync_status:
          existing.sync_status === "pending_create"
            ? ("pending_create" as const)
            : ("pending_update" as const),
      };
      ledger.aliases = ledger.aliases.map((alias) =>
        alias.id === existing.id ? updated : alias,
      );
      writeLedger(ledger);
      await flushDatabaseStorage();
      return updated;
    }
    const timestamp = new Date().toISOString();
    const alias = { ...recordMeta(timestamp), ...input };
    ledger.aliases.push(alias);
    writeLedger(ledger);
    await flushDatabaseStorage();
    return alias;
  }

  async archiveAlias(id: string) {
    const ledger = readLedger();
    const timestamp = new Date().toISOString();
    ledger.aliases = ledger.aliases.map((alias) =>
      alias.id === id
        ? {
            ...alias,
            deleted_at: timestamp,
            updated_at: timestamp,
            sync_status: "pending_delete" as const,
          }
        : alias,
    );
    writeLedger(ledger);
    await flushDatabaseStorage();
  }

  async postBatch(input: PaymentBatchInput, lines: PaymentLineInput[]) {
    if (!lines.length) throw new Error("Add at least one valid payment.");
    const ledger = readLedger();
    const settings = effectiveSettings(ledger.settings, input.payment_date);
    if (!settings)
      throw new Error(
        "No payment settings are effective for the payment date.",
      );
    const timestamp = new Date().toISOString();
    const batch = { ...recordMeta(timestamp), ...input };
    const payments = lines.map((line) => {
      const allocation = allocatePayment(
        line.amount_centavos,
        settings,
        ledger.payments.filter(
          (payment) => payment.member_id === line.member_id,
        ),
      );
      const payment = {
        ...recordMeta(timestamp),
        batch_id: batch.id,
        employee_id: line.employee_id,
        member_id: line.member_id,
        amount_centavos: line.amount_centavos,
        membership_fee_centavos: allocation.membershipFeeCentavos,
        capital_share_centavos: allocation.capitalShareCentavos,
        payment_date: input.payment_date,
        method: input.method,
        remarks: line.remarks,
      };
      ledger.payments.push(payment);
      return payment;
    });
    ledger.batches.push(batch);
    writeLedger(ledger);
    await flushDatabaseStorage();
    return { batch, payments };
  }

  async correctPayment(input: PaymentCorrectionInput) {
    const ledger = readLedger();
    const payment = ledger.payments.find(
      (item) => item.id === input.payment_id && !item.deleted_at,
    );
    if (!payment) throw new Error("Payment transaction was not found.");
    if (!input.comment.trim()) throw new Error("Enter a correction comment.");
    const timestamp = new Date().toISOString();
    const correction = {
      ...recordMeta(timestamp),
      payment_id: payment.id,
      from_amount_centavos: payment.amount_centavos,
      to_amount_centavos: input.amount_centavos,
      from_remarks: payment.remarks,
      to_remarks: input.remarks,
      comment: input.comment.trim(),
      corrected_by: input.corrected_by,
    };
    ledger.payments = ledger.payments.map((item) =>
      item.id === payment.id
        ? {
            ...item,
            amount_centavos: input.amount_centavos,
            remarks: input.remarks,
            updated_at: timestamp,
            sync_status:
              item.sync_status === "pending_create"
                ? "pending_create"
                : "pending_update",
          }
        : item,
    );
    const memberPayments = ledger.payments
      .filter(
        (item) => item.member_id === payment.member_id && !item.deleted_at,
      )
      .sort(
        (a, b) =>
          a.payment_date.localeCompare(b.payment_date) ||
          a.created_at.localeCompare(b.created_at),
      );
    const running: MemberPayment[] = [];
    for (const item of memberPayments) {
      const settings = effectiveSettings(ledger.settings, item.payment_date);
      if (!settings)
        throw new Error(`No payment settings apply on ${item.payment_date}.`);
      const allocation = allocatePayment(
        item.amount_centavos,
        settings,
        running,
      );
      Object.assign(item, {
        membership_fee_centavos: allocation.membershipFeeCentavos,
        capital_share_centavos: allocation.capitalShareCentavos,
      });
      running.push(item);
    }
    ledger.corrections.push(correction);
    writeLedger(ledger);
    await flushDatabaseStorage();
    return {
      payment: ledger.payments.find((item) => item.id === payment.id)!,
      correction,
    };
  }

  async saveRefund(input: RefundInput) {
    const ledger = readLedger();
    const timestamp = new Date().toISOString();
    if (
      input.cutoff_from &&
      input.cutoff_to &&
      input.cutoff_from > input.cutoff_to
    )
      throw new Error("Refund cut-off dates are invalid.");
    const existing = input.id
      ? ledger.refunds.find((item) => item.id === input.id)
      : null;
    const refund = existing
      ? {
          ...existing,
          ...input,
          id: existing.id,
          updated_at: timestamp,
          sync_status:
            existing.sync_status === "pending_create"
              ? ("pending_create" as const)
              : ("pending_update" as const),
        }
      : { ...recordMeta(timestamp), ...input };
    ledger.refunds = existing
      ? ledger.refunds.map((item) => (item.id === existing.id ? refund : item))
      : [...ledger.refunds, refund];
    writeLedger(ledger);
    await flushDatabaseStorage();
    return refund;
  }

  async settleFinalPay(input: SettlementInput) {
    const ledger = readLedger();
    if (
      ledger.settlements.some(
        (item) => !item.deleted_at && item.employee_id === input.employee_id,
      )
    )
      throw new Error(
        "A final-pay settlement already exists for this employment record.",
      );
    const payments = ledger.payments.filter(
      (payment) => payment.member_id === input.member_id && !payment.deleted_at,
    );
    const timestamp = new Date().toISOString();
    const settlement = {
      ...recordMeta(timestamp),
      ...input,
      capital_share_refund_centavos: payments.reduce(
        (sum, payment) => sum + payment.capital_share_centavos,
        0,
      ),
      membership_fee_refund_centavos: input.refund_membership_fee
        ? payments.reduce(
            (sum, payment) => sum + payment.membership_fee_centavos,
            0,
          )
        : 0,
    };
    ledger.settlements.push(settlement);
    writeLedger(ledger);
    await flushDatabaseStorage();
    return settlement;
  }
}
