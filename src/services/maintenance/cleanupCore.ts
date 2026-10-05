export type CleanupKind = "employee" | "member";
export type CleanupAction = "soft" | "hard" | "reset";
export type CleanupTarget = "selected" | "unassigned" | "all";
export type CleanupRequest = { kind: CleanupKind; action: CleanupAction; target: CleanupTarget; ids: string[]; confirmation: string };
export type MaintenanceRecord = { id: string; deleted_at?: string | null; member_id?: string | null; employee_id?: string; payment_id?: string; batch_id?: string; first_name?: string; last_name?: string; employee_number?: string; membership_number?: string; proposed_branch_id?: string | null; proposed_client_id?: string | null; supervisor_id?: string | null; active_assignment?: MaintenanceRecord | null; assignment_history?: MaintenanceRecord[]; branch_id?: string | null; client_id?: string | null; end_date?: string | null; [key: string]: unknown };
export type CleanupSnapshot = { employees: MaintenanceRecord[]; members: MaintenanceRecord[]; ledger: Record<string, unknown> };
export type CleanupListOptions = { kind: CleanupKind; search?: string; state?: "active" | "archived" | "all"; unassigned?: boolean; offset?: number; limit?: number };
export type CleanupListItem = { id: string; number: string; name: string; archived: boolean; unassigned: boolean };

export function assertCleanupRequest(input: CleanupRequest) {
  if (!["employee", "member"].includes(input.kind) || !["soft", "hard", "reset"].includes(input.action) || !["selected", "unassigned", "all"].includes(input.target)) throw new Error("Invalid cleanup operation.");
  if (!Array.isArray(input.ids) || input.ids.length > 500 || input.ids.some((id) => typeof id !== "string" || !id)) throw new Error("Select at most 500 records at once.");
  if (input.action !== "reset" && input.target === "selected" && !input.ids.length) throw new Error("Select records first.");
  const expected = input.action === "soft" ? "ARCHIVE" : input.action === "hard" ? "DELETE" : "RESET";
  if (input.confirmation !== expected) throw new Error(`Type ${expected} to confirm this operation.`);
}

function unassigned(record: MaintenanceRecord, kind: CleanupKind, linkedEmployees: Map<string, MaintenanceRecord>) {
  const linked = kind === "member" ? linkedEmployees.get(record.id) : undefined;
  if (linked) return !linked.active_assignment?.branch_id;
  return kind === "employee" ? !record.active_assignment?.branch_id : !record.proposed_branch_id;
}

export function listCleanupRecords(snapshot: CleanupSnapshot, options: CleanupListOptions) {
  const term = (options.search || "").trim().toLowerCase();
  const linkedEmployees = new Map(snapshot.employees.filter((item) => item.member_id && !item.deleted_at).map((item) => [item.member_id!, item]));
  const records = (options.kind === "employee" ? snapshot.employees : snapshot.members)
    .map((item): CleanupListItem => ({ id: item.id, number: item.employee_number || item.membership_number || "", name: `${item.last_name || ""}, ${item.first_name || ""}`, archived: Boolean(item.deleted_at), unassigned: unassigned(item, options.kind, linkedEmployees) }))
    .filter((item) => options.state === "all" || (options.state === "archived" ? item.archived : !item.archived))
    .filter((item) => !options.unassigned || item.unassigned)
    .filter((item) => `${item.number} ${item.name}`.toLowerCase().includes(term))
    .sort((a, b) => a.number.localeCompare(b.number) || a.id.localeCompare(b.id));
  const offset = Math.max(0, options.offset || 0), limit = Math.min(100, Math.max(1, options.limit || 25));
  return { items: records.slice(offset, offset + limit), total: records.length };
}

export function applyCleanup(snapshot: CleanupSnapshot, input: CleanupRequest, timestamp: string) {
  assertCleanupRequest(input);
  const selected = new Set(input.ids);
  const linkedEmployees = new Map(snapshot.employees.filter((item) => item.member_id && !item.deleted_at).map((item) => [item.member_id!, item]));
  const records = input.kind === "employee" ? snapshot.employees : snapshot.members;
  const matches = records.filter((item) => input.action === "reset" || (input.target === "all" || (input.target === "unassigned" ? !item.deleted_at && unassigned(item, input.kind, linkedEmployees) : selected.has(item.id))));
  const employeeIds = new Set(input.action === "reset" ? snapshot.employees.map((item) => item.id) : input.kind === "employee" ? matches.map((item) => item.id) : []);
  const memberIds = new Set(input.action === "reset" ? snapshot.members.map((item) => item.id) : input.kind === "member" ? matches.map((item) => item.id) : []);
  // Linked member and employee records are always cleaned together.
  snapshot.employees.forEach((item) => { if (employeeIds.has(item.id) && item.member_id) memberIds.add(item.member_id); if (item.member_id && memberIds.has(item.member_id)) employeeIds.add(item.id); });
  if (input.action === "reset") snapshot.employees.forEach((item) => employeeIds.add(item.id));
  const affected = (item: MaintenanceRecord) => employeeIds.has(item.employee_id || "") || memberIds.has(item.member_id || "");
  const mark = (item: MaintenanceRecord) => ({ ...item, deleted_at: timestamp, updated_at: timestamp, sync_status: "pending_delete" });
  const clean = (items: MaintenanceRecord[], predicate: (item: MaintenanceRecord) => boolean) => input.action === "soft" ? items.map((item) => predicate(item) && !item.deleted_at ? mark(item) : item) : items.filter((item) => !predicate(item));
  const employees = clean(snapshot.employees, (item) => employeeIds.has(item.id)).map((item) => employeeIds.has(item.supervisor_id || "") && input.action !== "soft" ? { ...item, supervisor_id: null } : item);
  const members = clean(snapshot.members, (item) => memberIds.has(item.id));
  const ledger = { ...snapshot.ledger };
  const payments = (ledger.payments || []) as MaintenanceRecord[];
  const paymentIds = new Set(payments.filter(affected).map((item) => item.id));
  const affectedBatchIds = new Set(payments.filter(affected).map((item) => item.batch_id));
  if (input.action !== "soft") {
    for (const key of ["aliases", "payments", "refunds", "settlements", "corrections"]) {
      ledger[key] = input.action === "reset" ? [] : ((ledger[key] || []) as MaintenanceRecord[]).filter((item) => key === "corrections" ? !paymentIds.has(item.payment_id || "") : !affected(item));
    }
    const remainingPayments = ledger.payments as MaintenanceRecord[];
    const batchIds = new Set(remainingPayments.map((item) => item.batch_id));
    ledger.batches = input.action === "reset" ? [] : ((ledger.batches || []) as MaintenanceRecord[]).filter((item) => !affectedBatchIds.has(item.id) || batchIds.has(item.id));
    ledger.paymentTotal = remainingPayments.filter((item) => !item.deleted_at).length;
    ledger.refundTotal = (ledger.refunds as MaintenanceRecord[]).filter((item) => !item.deleted_at).length;
  }
  return { snapshot: { employees, members, ledger }, employeeIds: [...employeeIds], memberIds: [...memberIds], result: { employees: employeeIds.size, members: memberIds.size, payments: input.action === "soft" ? 0 : paymentIds.size } };
}
