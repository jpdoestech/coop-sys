import type { Member, MemberInput } from "../../../types/member";
import { developmentMembers } from "../../../database/seeds/memberSeed";
import type { ListOptions } from "../Repository";
import type { MemberRepository } from "../MemberRepository";

const STORAGE_KEY = "coop_sys_members";

function now() {
  return new Date().toISOString();
}

function readMembers(): Member[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    return JSON.parse(raw) as Member[];
  }

  if (import.meta.env.DEV) {
    writeMembers(developmentMembers);
    return developmentMembers;
  }

  return [];
}

function writeMembers(members: Member[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(members));
}

export class LocalMemberRepository implements MemberRepository {
  async list(options: ListOptions = {}) {
    let members = readMembers();

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
    return readMembers().find((member) => member.id === id) ?? null;
  }

  async findByMembershipNumber(membershipNumber: string) {
    return (
      readMembers().find((member) => member.membership_number === membershipNumber) ?? null
    );
  }

  async create(input: MemberInput) {
    const timestamp = now();
    const member: Member = {
      ...input,
      id: crypto.randomUUID(),
      created_at: timestamp,
      updated_at: timestamp,
      deleted_at: null,
      sync_status: "pending_create"
    };
    writeMembers([...readMembers(), member]);
    return member;
  }

  async update(id: string, input: Partial<MemberInput>) {
    const members = readMembers();
    const index = members.findIndex((member) => member.id === id);

    if (index === -1) {
      throw new Error("Member not found.");
    }

    const member: Member = {
      ...members[index],
      ...input,
      updated_at: now(),
      sync_status:
        members[index].sync_status === "pending_create" ? "pending_create" : "pending_update"
    };
    members[index] = member;
    writeMembers(members);
    return member;
  }

  async archive(id: string) {
    const members = readMembers();
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
    writeMembers(members);
  }

  async restore(id: string) {
    const members = readMembers();
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
    writeMembers(members);
    return restored;
  }
}
