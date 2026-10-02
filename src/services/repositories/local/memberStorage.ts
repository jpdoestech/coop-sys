import { developmentMembers } from "../../../database/seeds/memberSeed";
import type { Member } from "../../../types/member";
import { normalizePersonNumber } from "../../identity/personNumber";
import { readPersistentItem, writePersistentItem } from "../../server/databaseStorage";

const STORAGE_KEY = "coop_sys_members";

function normalizeMember(member: Member): Member {
  const resolutionToken = member.acceptance_resolution_number?.split("-").at(-1) ?? "";
  const rawResolutionDigits = resolutionToken.replace(/\D/g, "").slice(-6);
  const resolutionDigits = member.id.startsWith("70000000-") && /^26\d{4}$/.test(rawResolutionDigits)
    ? rawResolutionDigits.slice(-4)
    : rawResolutionDigits;
  const resolutionNumber = resolutionDigits ? resolutionDigits.padStart(6, "0") : null;
  const approvalStatus = member.bod_approval_status ?? (resolutionNumber ? "approved" : "pending");
  return {
    ...member,
    membership_number: normalizePersonNumber(member.membership_number),
    acceptance_resolution_number: resolutionNumber,
    acceptance_date: member.acceptance_date ?? (approvalStatus === "approved" ? member.membership_date : null),
    bod_approval_status: approvalStatus,
    beneficiaries: member.beneficiaries ?? [],
  };
}

export function readStoredMembers(): Member[] {
  const raw = readPersistentItem(STORAGE_KEY);
  if (raw) {
    const employeeRaw = readPersistentItem("coop_sys_employees");
    const employeeBeneficiaries = new Map<string, Member["beneficiaries"]>();
    if (employeeRaw) {
      (JSON.parse(employeeRaw) as Array<{ member_id?: string | null; beneficiaries?: Member["beneficiaries"] }>).forEach((employee) => {
        if (employee.member_id && employee.beneficiaries?.length) employeeBeneficiaries.set(employee.member_id, employee.beneficiaries);
      });
    }
    return (JSON.parse(raw) as Member[]).map((stored) => {
      const member = normalizeMember(stored);
      return member.beneficiaries.length ? member : { ...member, beneficiaries: employeeBeneficiaries.get(member.id) ?? [] };
    });
  }
  if (import.meta.env.DEV) {
    writeStoredMembers(developmentMembers);
    return developmentMembers.map(normalizeMember);
  }
  return [];
}

export function writeStoredMembers(members: Member[]) {
  writePersistentItem(STORAGE_KEY, JSON.stringify(members));
}
