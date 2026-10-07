import type { Member, MemberInput } from "../../../types/member";
import type { ListOptions } from "../Repository";
import type { MemberRepository } from "../MemberRepository";
import { readStoredMembers, writeStoredMembers } from "./memberStorage";
import { createUuid } from "../../../utils/createUuid";
import { flushDatabaseStorage, readPersistentItem } from "../../server/databaseStorage";
import { hydrateDatabaseStorage, writePersistentItem } from "../../server/databaseStorage";
import { serverRequest, usesServerBackend } from "../../server/serverApi";
import { nextBodResolutionNumber } from "../../members/membershipApproval";
import { MEMBER_STATUS } from "../../lookups/statuses";
import { employeeProfileFromMember } from "../../identity/personProfileSync";

const APPROVAL_SEQUENCE_KEY = "coop_sys_bod_approval_sequence";
let approvalQueue: Promise<unknown> = Promise.resolve();

function now() {
  return new Date().toISOString();
}

export class LocalMemberRepository implements MemberRepository {
  async nextApprovalNumber() {
    if (usesServerBackend()) return (await serverRequest<{ number: string }>("/members/approval-number")).number;
    const highest = Math.max(Number(nextBodResolutionNumber(readStoredMembers())) - 1, Number(readPersistentItem(APPROVAL_SEQUENCE_KEY)) || 0);
    if (highest >= 999999) throw new Error("The six-digit BOD resolution sequence is exhausted.");
    return String(highest + 1).padStart(6, "0");
  }

  async approve(ids: string[], approvalDate: string) {
    if (usesServerBackend()) {
      await flushDatabaseStorage();
      const result = await serverRequest<{ number: string }>("/members/approve", { method: "POST", body: JSON.stringify({ ids, approvalDate }) });
      await hydrateDatabaseStorage();
      return result.number;
    }
    const run = async () => {
      const members = readStoredMembers(), selected = new Set(ids);
      if (!selected.size || selected.size !== ids.length || members.filter((member) => selected.has(member.id) && !member.deleted_at && member.bod_approval_status === "pending").length !== selected.size) throw new Error("Only pending membership applications can be approved.");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(approvalDate) || !Number.isFinite(Date.parse(approvalDate)) || new Date(approvalDate).toISOString().slice(0, 10) !== approvalDate) throw new Error("Enter a valid approval date.");
      const number = await this.nextApprovalNumber(), timestamp = now();
      const approved = members.map((member) => selected.has(member.id) ? { ...member, bod_approval_status: "approved" as const, acceptance_date: approvalDate, acceptance_resolution_number: number, membership_status_id: MEMBER_STATUS.active, updated_at: timestamp, sync_status: member.sync_status === "pending_create" ? "pending_create" as const : "pending_update" as const } : member);
      writePersistentItem(APPROVAL_SEQUENCE_KEY, number);
      writeStoredMembers(approved);
      const employees = JSON.parse(readPersistentItem("coop_sys_employees") || "[]") as Array<Record<string, unknown>>;
      writePersistentItem("coop_sys_employees", JSON.stringify(employees.map((employee) => {
        const member = approved.find((item) => selected.has(item.id) && item.id === employee.member_id);
        return member ? { ...employee, ...employeeProfileFromMember(member), updated_at: timestamp, sync_status: employee.sync_status === "pending_create" ? "pending_create" : "pending_update" } : employee;
      })));
      await flushDatabaseStorage();
      return number;
    };
    if (typeof navigator !== "undefined" && navigator.locks) return navigator.locks.request("coop-bod-approval", run);
    const result = approvalQueue.then(run, run);
    approvalQueue = result.catch(() => undefined);
    return result;
  }
  private filtered(options: ListOptions = {}) {
    let members = readStoredMembers();
    if (!options.includeDeleted) members = members.filter((member) => !member.deleted_at);
    if (options.attentionOnly) members = members.filter((item) => Object.keys(item.import_attention || {}).length || item.pending_department_name || item.pending_position_name);
    if (options.search) { const search = options.search.toLowerCase(); members = members.filter((member) => [member.membership_number, member.first_name, member.last_name].join(" ").toLowerCase().includes(search)); }
    if (options.statusId) members = members.filter((member) => member.membership_status_id === options.statusId);
    if (options.typeId) members = members.filter((member) => member.membership_type_id === options.typeId);
    if (options.approvalStatus) members = members.filter((member) => member.bod_approval_status === options.approvalStatus);
    if (options.branchId || options.clientId) {
      const assignments = (JSON.parse(readPersistentItem("coop_sys_employees") ?? "[]") as Array<{ member_id?: string | null; active_assignment?: { branch_id?: string | null; client_id?: string | null } | null }>);
      const visible = new Set(assignments.filter((employee) => employee.member_id && (!options.branchId || employee.active_assignment?.branch_id === options.branchId) && (!options.clientId || employee.active_assignment?.client_id === options.clientId)).map((employee) => employee.member_id));
      members = members.filter((member) => assignments.some((employee) => employee.member_id === member.id)
        ? visible.has(member.id)
        : (!options.branchId || member.proposed_branch_id === options.branchId) && (!options.clientId || member.proposed_client_id === options.clientId));
    }
    return members.sort((a, b) => options.sort === "name-desc" ? b.last_name.localeCompare(a.last_name) : options.sort === "number-asc" ? a.membership_number.localeCompare(b.membership_number) : options.sort === "joined-desc" ? (b.membership_date ?? "").localeCompare(a.membership_date ?? "") : a.last_name.localeCompare(b.last_name));
  }

  async list(options: ListOptions = {}) {
    return this.filtered(options)
      .slice(options.offset ?? 0, options.limit ? (options.offset ?? 0) + options.limit : undefined);
  }

  async listPage(options: ListOptions = {}) { const records = this.filtered(options); const offset = options.offset ?? 0; return { items: records.slice(offset, options.limit ? offset + options.limit : undefined), total: records.length }; }

  async getById(id: string) {
    return readStoredMembers().find((member) => member.id === id) ?? null;
  }

  async findByMembershipNumber(membershipNumber: string) {
    return (
      readStoredMembers().find((member) => member.membership_number === membershipNumber) ?? null
    );
  }

  async create(input: MemberInput) {
    const timestamp = now();
    const member: Member = {
      ...input,
      beneficiaries: input.beneficiaries.map((beneficiary) => ({ ...beneficiary, deactivated_at: beneficiary.is_active ? null : timestamp })),
      id: createUuid(),
      created_at: timestamp,
      updated_at: timestamp,
      deleted_at: null,
      sync_status: "pending_create"
    };
    writeStoredMembers([...readStoredMembers(), member]);
    await flushDatabaseStorage();
    return member;
  }

  async update(id: string, input: Partial<MemberInput>) {
    const members = readStoredMembers();
    const index = members.findIndex((member) => member.id === id);

    if (index === -1) {
      throw new Error("Member not found.");
    }

    const member: Member = {
      ...members[index],
      ...input,
      beneficiaries: (input.beneficiaries ?? members[index].beneficiaries).map((beneficiary) => ({
        ...beneficiary,
        deactivated_at: beneficiary.is_active ? null : members[index].beneficiaries.find((item) => item.id === beneficiary.id)?.deactivated_at ?? now(),
      })),
      updated_at: now(),
      sync_status:
        members[index].sync_status === "pending_create" ? "pending_create" : "pending_update"
    };
    members[index] = member;
    writeStoredMembers(members);
    await flushDatabaseStorage();
    return member;
  }

  async archive(id: string) {
    const members = readStoredMembers();
    const index = members.findIndex((member) => member.id === id);

    if (index === -1) {
      throw new Error("Member not found.");
    }

    members[index] = {
      ...members[index],
      updated_at: now(),
      deleted_at: now(),
      sync_status:
        members[index].sync_status === "pending_create" ? "pending_create" : "pending_delete"
    };
    writeStoredMembers(members);
    await flushDatabaseStorage();
  }

  async restore(id: string) {
    const members = readStoredMembers();
    const index = members.findIndex((member) => member.id === id);

    if (index === -1) {
      throw new Error("Member not found.");
    }

    const restored: Member = {
      ...members[index],
      deleted_at: null,
      updated_at: now(),
      sync_status:
        members[index].sync_status === "pending_create" ? "pending_create" : "pending_update"
    };
    members[index] = restored;
    writeStoredMembers(members);
    await flushDatabaseStorage();
    return restored;
  }
}
