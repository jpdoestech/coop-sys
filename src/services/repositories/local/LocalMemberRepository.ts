import type { Member, MemberInput } from "../../../types/member";
import type { ListOptions } from "../Repository";
import type { MemberRepository } from "../MemberRepository";
import { readStoredMembers, writeStoredMembers } from "./memberStorage";

function now() {
  return new Date().toISOString();
}

export class LocalMemberRepository implements MemberRepository {
  async list(options: ListOptions = {}) {
    let members = readStoredMembers();

    if (!options.includeDeleted) {
      members = members.filter((member) => !member.deleted_at);
    }

    if (options.search) {
      const search = options.search.toLowerCase();
      members = members.filter((member) =>
        [member.membership_number, member.first_name, member.last_name]
          .join(" ")
          .toLowerCase()
          .includes(search)
      );
    }

    return members
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
      .slice(options.offset ?? 0, options.limit ? (options.offset ?? 0) + options.limit : undefined);
  }

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
