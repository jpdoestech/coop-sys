import { describe, expect, it } from "vitest";
import { applyCleanup, listCleanupRecords, type CleanupRequest, type CleanupSnapshot } from "./cleanupCore";

const fixture = (): CleanupSnapshot => ({
  employees: [{ id: "e1", employee_number: "000001", member_id: "m1", first_name: "Alpha", last_name: "Person", active_assignment: null }, { id: "e2", employee_number: "000002", member_id: "m2", supervisor_id: "e1", first_name: "Beta", last_name: "Person", active_assignment: { id: "a2", branch_id: "b1" } }],
  members: [{ id: "m1", membership_number: "000001", proposed_branch_id: null }, { id: "m2", membership_number: "000002", proposed_branch_id: null }],
  ledger: { settings: [{ id: "settings" }], aliases: [{ id: "alias1", employee_id: "e1" }], payments: [{ id: "p1", employee_id: "e1", member_id: "m1", batch_id: "batch" }, { id: "p2", employee_id: "e2", member_id: "m2", batch_id: "batch" }], batches: [{ id: "batch" }, { id: "empty-unrelated" }], corrections: [{ id: "c1", payment_id: "p1" }], refunds: [{ id: "r1", employee_id: "e1" }], settlements: [{ id: "s1", member_id: "m1" }] },
});
const request = (action: CleanupRequest["action"]): CleanupRequest => ({ kind: "employee", action, target: "selected", ids: ["e1"], confirmation: action === "soft" ? "ARCHIVE" : action === "hard" ? "DELETE" : "RESET" });

describe("people cleanup", () => {
  it("paginates matching records and uses actual deployment for linked members", () => {
    expect(listCleanupRecords(fixture(), { kind: "employee", limit: 1, offset: 1 })).toMatchObject({ total: 2, items: [{ id: "e2" }] });
    expect(listCleanupRecords(fixture(), { kind: "member", unassigned: true }).items.map((item) => item.id)).toEqual(["m1"]);
  });
  it("archives linked people together but retains all financial history", () => {
    const before = fixture(), result = applyCleanup(before, request("soft"), "2026-10-05");
    expect(result.snapshot.employees[0].deleted_at).toBe("2026-10-05");
    expect(result.snapshot.members[0].sync_status).toBe("pending_delete");
    expect(result.snapshot.ledger).toEqual(before.ledger);
    expect(before.employees[0].deleted_at).toBeUndefined();
  });
  it("hard deletes dependents without removing unrelated batches or settings", () => {
    const result = applyCleanup(fixture(), request("hard"), "2026-10-05");
    expect(result.result).toEqual({ employees: 1, members: 1, payments: 1 });
    expect(result.snapshot.employees).toMatchObject([{ id: "e2", supervisor_id: null }]);
    expect(result.snapshot.members).toMatchObject([{ id: "m2" }]);
    expect(result.snapshot.ledger).toMatchObject({ aliases: [], corrections: [], refunds: [], settlements: [], batches: [{ id: "batch" }, { id: "empty-unrelated" }], settings: [{ id: "settings" }] });
  });
  it("resets all people and transactions regardless of the currently selected kind", () => {
    const result = applyCleanup(fixture(), { ...request("reset"), kind: "member", target: "all", ids: [] }, "2026-10-05");
    expect(result.result).toEqual({ employees: 2, members: 2, payments: 2 });
    expect(result.snapshot.employees).toEqual([]); expect(result.snapshot.members).toEqual([]);
    expect(result.snapshot.ledger).toMatchObject({ payments: [], batches: [], paymentTotal: 0, refundTotal: 0, settings: [{ id: "settings" }] });
  });
  it("rejects an incorrect confirmation and empty bulk selection", () => {
    expect(() => applyCleanup(fixture(), { ...request("hard"), confirmation: "ARCHIVE" }, "now")).toThrow("Type DELETE");
    expect(() => applyCleanup(fixture(), { ...request("hard"), ids: [] }, "now")).toThrow("Select records");
  });
});
