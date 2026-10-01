import type { PaymentLedger, PaymentSettings } from "../../../types/payment";
import { allocatePayment, effectiveSettings } from "../../payments/paymentMath";
import type { AliasInput, PaymentBatchInput, PaymentLineInput, PaymentRepository, PaymentSettingsInput, SettlementInput } from "../PaymentRepository";

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
  return { settings: [DEFAULT_SETTINGS], aliases: [], batches: [], payments: [], settlements: [], paymentTotal: 0 };
}

function readLedger(): PaymentLedger {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return emptyLedger();
  const stored = JSON.parse(raw) as Partial<PaymentLedger>;
  return { ...emptyLedger(), ...stored, settings: stored.settings?.length ? stored.settings : [DEFAULT_SETTINGS] };
}

function writeLedger(ledger: PaymentLedger) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ledger));
}

function recordMeta(timestamp: string) {
  return { id: crypto.randomUUID(), created_at: timestamp, updated_at: timestamp, deleted_at: null, sync_status: "pending_create" as const };
}

export class LocalPaymentRepository implements PaymentRepository {
  async getLedger(options: { limit?: number; offset?: number; employeeIds?: string[] } = {}) { const ledger = readLedger(); const allowed = options.employeeIds ? new Set(options.employeeIds) : null; const filtered = allowed ? ledger.payments.filter((payment) => allowed.has(payment.employee_id)) : ledger.payments; const paymentTotal = filtered.length; const offset = options.offset ?? 0; return { ...ledger, payments: options.limit ? filtered.slice(offset, offset + options.limit) : filtered, paymentTotal }; }

  async saveSettings(input: PaymentSettingsInput) {
    const ledger = readLedger();
    const timestamp = new Date().toISOString();
    ledger.settings = ledger.settings.map((setting) => setting.is_active && setting.effective_from < input.effective_from
      ? { ...setting, is_active: false, effective_to: new Date(new Date(`${input.effective_from}T00:00:00`).getTime() - 86400000).toISOString().slice(0, 10), updated_at: timestamp }
      : setting);
    const settings: PaymentSettings = { id: crypto.randomUUID(), ...input, effective_to: null, is_active: true, created_at: timestamp, updated_at: timestamp };
    ledger.settings.push(settings);
    writeLedger(ledger);
    return settings;
  }

  async saveAlias(input: AliasInput) {
    const ledger = readLedger();
    const duplicate = ledger.aliases.find((alias) => !alias.deleted_at && alias.client_id === input.client_id && alias.normalized_alias === input.normalized_alias && alias.employee_id !== input.employee_id);
    if (duplicate) throw new Error("This alias already belongs to another employee for the selected client.");
    const existing = ledger.aliases.find((alias) => !alias.deleted_at && alias.client_id === input.client_id && alias.normalized_alias === input.normalized_alias && alias.employee_id === input.employee_id);
    if (existing) return existing;
    const timestamp = new Date().toISOString();
    const alias = { ...recordMeta(timestamp), ...input };
    ledger.aliases.push(alias);
    writeLedger(ledger);
    return alias;
  }

  async postBatch(input: PaymentBatchInput, lines: PaymentLineInput[]) {
    if (!lines.length) throw new Error("Add at least one valid payment.");
    const ledger = readLedger();
    const settings = effectiveSettings(ledger.settings, input.payment_date);
    if (!settings) throw new Error("No payment settings are effective for the payment date.");
    const timestamp = new Date().toISOString();
    const batch = { ...recordMeta(timestamp), ...input };
    const payments = lines.map((line) => {
      const allocation = allocatePayment(line.amount_centavos, settings, ledger.payments.filter((payment) => payment.member_id === line.member_id));
      const payment = { ...recordMeta(timestamp), batch_id: batch.id, employee_id: line.employee_id, member_id: line.member_id, amount_centavos: line.amount_centavos, membership_fee_centavos: allocation.membershipFeeCentavos, capital_share_centavos: allocation.capitalShareCentavos, payment_date: input.payment_date, method: input.method, remarks: line.remarks };
      ledger.payments.push(payment);
      return payment;
    });
    ledger.batches.push(batch);
    writeLedger(ledger);
    return { batch, payments };
  }

  async settleFinalPay(input: SettlementInput) {
    const ledger = readLedger();
    if (ledger.settlements.some((item) => !item.deleted_at && item.employee_id === input.employee_id)) throw new Error("A final-pay settlement already exists for this employment record.");
    const payments = ledger.payments.filter((payment) => payment.member_id === input.member_id && !payment.deleted_at);
    const timestamp = new Date().toISOString();
    const settlement = {
      ...recordMeta(timestamp), ...input,
      capital_share_refund_centavos: payments.reduce((sum, payment) => sum + payment.capital_share_centavos, 0),
      membership_fee_refund_centavos: input.refund_membership_fee ? payments.reduce((sum, payment) => sum + payment.membership_fee_centavos, 0) : 0,
    };
    ledger.settlements.push(settlement);
    writeLedger(ledger);
    return settlement;
  }
}
