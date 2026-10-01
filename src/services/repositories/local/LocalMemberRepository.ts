import type { Member, MemberInput } from "../../../types/member";
import type { ListOptions } from "../Repository";
import type { MemberRepository } from "../MemberRepository";
import { readStoredMembers, writeStoredMembers } from "./memberStorage";

function now() {
  return new Date().toISOString();
}

export class LocalMemberRepository implements MemberRepository {
  private filtered(options: ListOptions = {}) {
    let members = readStoredMembers();
    if (!options.includeDeleted) members = members.filter((member) => !member.deleted_at);
    if (options.search) { const search = options.search.toLowerCase(); members = members.filter((member) => [member.membership_number, member.first_name, member.last_name].join(" ").toLowerCase().includes(search)); }
    if (options.statusId) members = members.filter((member) => member.membership_status_id === options.statusId);
    if (options.typeId) members = members.filter((member) => member.membership_type_id === options.typeId);
    if (options.approvalStatus) members = members.filter((member) => member.bod_approval_status === options.approvalStatus);
    if (options.branchId || options.clientId) {
      const assignments = (JSON.parse(localStorage.getItem("coop_sys_employees") ?? "[]") as Array<{ member_id?: string | null; active_assignment?: { branch_id?: string | null; client_id?: string | null } | null }>);
      const visible = new Set(assignments.filter((employee) => employee.member_id && (!options.branchId || employee.active_assignment?.branch_id === options.branchId) && (!options.clientId || employee.active_assignment?.client_id === options.clientId)).map((employee) => employee.member_id));
      members = members.filter((member) => visible.has(member.id));
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
      id: crypto.randomUUID(),
      created_at: timestamp,
      updated_at: timestamp,
      deleted_at: null,
      sync_status: "pending_create"
    };
    writeStoredMembers([...readStoredMembers(), member]);
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
    return restored;
  }
}
