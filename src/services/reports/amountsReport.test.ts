// @vitest-environment node
import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { sqliteReportPage } from "./sqliteReports";
import type { ReportQuery } from "../repositories/ReportRepository";

let db: DatabaseSync;
const scope: { scopeType: string; branchIds: string[]; clientIds: string[] } = { scopeType: "organization", branchIds: [], clientIds: [] };
const load = (options: Partial<ReportQuery> = {}, access = scope) => sqliteReportPage(db, { kind: "amounts", ...options }, access);
beforeEach(() => {
  db = new DatabaseSync(":memory:");
  db.exec("create table app_storage(storage_key text primary key,value text)");
  const write = (key: string, value: unknown) => db.prepare("insert into app_storage values(?,?)").run(key, JSON.stringify(value));
  write("coop_sys_organization_directory", { branches: [{ id: "A", label: "Alpha" }, { id: "B", label: "Beta" }], clients: [{ id: "C", label: "Client One" }, { id: "D", label: "Client Two" }] });
  write("coop_sys_members", [
    { id: "m1", first_name: "Juan", last_name: "Dela Cruz" }, { id: "m2", first_name: "Maria", last_name: "Cruz" },
    { id: "m3", first_name: "Direct", proposed_branch_id: "A" }, { id: "m4", first_name: "Other" }, { id: "m5", deleted_at: "2026-01-01" },
  ]);
  write("coop_sys_employees", [
    { id: "e1", member_id: "m1", active_assignment: { branch_id: "A", client_id: "C" } },
    { id: "e2", member_id: "m2", active_assignment: { branch_id: "A", client_id: "D" } },
    { id: "e4", member_id: "m4", active_assignment: { branch_id: "B", client_id: null } },
  ]);
  write("coop_sys_payment_ledger", { settings: [{ id: "s1", membership_fee_centavos: 50000, capital_share_target_centavos: 500000, effective_from: "2020-01-01", updated_at: "2020-01-01", created_at: "2020-01-01" }], payments: [
    { employee_id: "e1", member_id: "m1", amount_centavos: 50000, payment_date: "2026-01-01" },
    { employee_id: "e1", member_id: "m1", amount_centavos: 500000, payment_date: "2026-02-01" },
    { employee_id: "e2", member_id: "m2", amount_centavos: 100000, payment_date: "2026-01-15" },
    { employee_id: "e4", member_id: "m4", amount_centavos: 200000, payment_date: "2026-01-15" },
    { employee_id: "e2", member_id: "m2", amount_centavos: 900000, payment_date: "2026-01-15", deleted_at: "2026-02-01" },
  ] });
});
afterEach(() => db.close());

describe("member amounts report", () => {
  it("separates remaining overpayment from unpaid outstanding and settles it after refunds", () => {
    const ledger = JSON.parse(db.prepare("select value from app_storage where storage_key='coop_sys_payment_ledger'").get()!.value as string);
    ledger.payments = [{ employee_id: "e1", member_id: "m1", amount_centavos: 1215000, membership_fee_centavos: 125000, capital_share_centavos: 1090000, payment_date: "2026-10-12" }];
    ledger.refunds = [{ employee_id: "e1", member_id: "m1", amount_centavos: 540000, refund_date: "2026-10-12" }];
    const write = () => db.prepare("update app_storage set value=? where storage_key='coop_sys_payment_ledger'").run(JSON.stringify(ledger));
    write();
    const page = load({ search: "Juan" });
    expect(page).toMatchObject({ records: 1, paid: 0, unpaid: 0, overpaid: 1, amountCentavos: 1215000, refundCentavos: 540000, netPaidCentavos: 675000, overpaidCentavos: 125000, balanceCentavos: 0 });
    for (const row of page.items) expect(row).toMatchObject({ overpaid: 1, overpaidCentavos: 125000, netPaidCentavos: 675000, overpaidAmountCentavos: 675000, paidAmountCentavos: 0, unpaidAmountCentavos: 0 });
    expect(load({ paymentStatus: "overpaid" }).records).toBe(1);
    expect(load({ paymentStatus: "paid" }).records).toBe(0);
    ledger.refunds[0].amount_centavos = 665000;
    write();
    expect(load({ search: "Juan" })).toMatchObject({ paid: 1, unpaid: 0, overpaid: 0, netPaidCentavos: 550000, overpaidCentavos: 0, balanceCentavos: 0 });
    expect(load({ paymentStatus: "overpaid" }).records).toBe(0);
    expect(load({ search: "Juan" }).items[0].paidAmountCentavos).toBe(550000);
  });

  it("uses configured obligations and excludes deleted refunds", () => {
    const ledger = JSON.parse(db.prepare("select value from app_storage where storage_key='coop_sys_payment_ledger'").get()!.value as string);
    ledger.settings[0].capital_share_target_centavos = 400000;
    ledger.refunds = [{ employee_id: "e1", member_id: "m1", amount_centavos: 100000, refund_date: "2026-02-02", deleted_at: "2026-02-03" }];
    db.prepare("update app_storage set value=? where storage_key='coop_sys_payment_ledger'").run(JSON.stringify(ledger));
    expect(load({ search: "Juan" })).toMatchObject({ overpaid: 1, refundCentavos: 0, overpaidCentavos: 100000, netPaidCentavos: 550000 });
  });
  it("includes gross components and refunds without counting branch/client totals twice", () => {
    db.prepare("update app_storage set value=? where storage_key='coop_sys_payment_ledger'").run(JSON.stringify({ settings: [{ id: "s", membership_fee_centavos: 50000, capital_share_target_centavos: 500000, effective_from: "2020-01-01", updated_at: "2020", created_at: "2020" }], payments: [{ employee_id: "e1", member_id: "m1", amount_centavos: 650000, membership_fee_centavos: 50000, capital_share_centavos: 600000, payment_date: "2026-01-01" }], refunds: [{ employee_id: "e1", member_id: "m1", amount_centavos: 100000, refund_date: "2026-01-02" }] }));
    const page = load({ search: "Juan" });
    expect(page.items.find((row) => row.level === "branch")).toMatchObject({ paid: 1, membershipFeeCentavos: 50000, capitalShareCentavos: 600000, refundCentavos: 100000, retainedCapitalShareCentavos: 500000, overpaidCentavos: 0 });
  });
  it("counts each member once in overall totals and rolls clients into branch totals", () => {
    const page = load();
    expect(page).toMatchObject({ records: 4, paid: 1, unpaid: 3, amountCentavos: 850000, balanceCentavos: 1350000, total: 6 });
    expect(page.items[0]).toMatchObject({ branch: "Alpha", level: "branch", members: 3, paid: 1, unpaid: 2, amountCentavos: 650000, paidAmountCentavos: 550000, unpaidAmountCentavos: 100000, balanceCentavos: 1000000 });
    expect(page.items.filter((row) => row.level === "client" && row.branchId === "A").reduce((total, row) => total + row.amountCentavos!, 0)).toBe(page.items[0].amountCentavos);
    expect(page.items.find((row) => row.branchId === "A" && row.level === "client" && !row.clientId)).toMatchObject({ members: 1, unpaid: 1, amountCentavos: 0 });
  });

  it("filters paid and unpaid members before computing branch totals", () => {
    expect(load({ paymentStatus: "paid" })).toMatchObject({ records: 1, paid: 1, unpaid: 0, amountCentavos: 550000, balanceCentavos: 0 });
    expect(load({ paymentStatus: "unpaid" })).toMatchObject({ records: 3, paid: 0, unpaid: 3, amountCentavos: 300000, balanceCentavos: 1350000 });
  });

  it("uses payment dates and retains members with no payments in the period", () => {
    expect(load({ dateFrom: "2026-02-01", dateTo: "2026-02-28" })).toMatchObject({ records: 4, paid: 0, unpaid: 4, amountCentavos: 500000, balanceCentavos: 1700000 });
    expect(load({ dateFrom: "2027-01-01", dateTo: "2027-12-31" })).toMatchObject({ records: 4, paid: 0, amountCentavos: 0 });
  });

  it("enforces branch, client, and self access before aggregation", () => {
    expect(load({}, { ...scope, scopeType: "assigned_branches", branchIds: ["A"] })).toMatchObject({ records: 3, amountCentavos: 650000 });
    expect(load({}, { ...scope, scopeType: "assigned_clients", clientIds: ["D"] })).toMatchObject({ records: 1, amountCentavos: 100000 });
    expect(load({}, { ...scope, scopeType: "assigned_branches" })).toMatchObject({ records: 0, total: 0 });
    const self = sqliteReportPage(db, { kind: "amounts" }, { ...scope, scopeType: "self", linkedEmployeeId: "e1" });
    expect(self).toMatchObject({ records: 1, paid: 1, amountCentavos: 550000 });
    expect(load({}, { ...scope, scopeType: "self" })).toMatchObject({ records: 0, total: 0 });
  });

  it("supports placement filters, either name order, numeric sorting, and paging", () => {
    expect(load({ branchId: "A", clientId: "D" })).toMatchObject({ records: 1, total: 2, amountCentavos: 100000 });
    for (const search of ["Juan Dela Cruz", "Dela Cruz, Juan"]) expect(load({ search })).toMatchObject({ records: 1, amountCentavos: 550000 });
    const first = load({ limit: 1 }), second = load({ limit: 1, offset: 1 });
    expect(first).toMatchObject({ total: 6, records: 4, amountCentavos: 850000 });
    expect(first.items[0].id).not.toBe(second.items[0].id);
    expect(load({ sort: "amountCentavos", direction: "desc", limit: 1 }).items[0].amountCentavos).toBe(650000);
  });

  it("validates dates, payment status, and sort input", () => {
    expect(() => load({ dateFrom: "2026-02-30" })).toThrow();
    expect(() => load({ dateFrom: "2026-02-01", dateTo: "2026-01-01" })).toThrow();
    expect(() => load({ paymentStatus: "invalid" as never })).toThrow();
    expect(() => load({ sort: "members;drop table" as never })).toThrow();
  });
});
