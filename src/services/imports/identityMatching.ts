import type { Employee } from "../../types/employee";
import type { MemberAlias, PaymentImportMatch, PaymentImportRow } from "../../types/payment";

export function normalizeIdentityName(value: string) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

export function employeeFullName(employee: Employee) {
  return [employee.first_name, employee.middle_name, employee.last_name, employee.suffix].filter(Boolean).join(" ");
}

function grams(value: string) {
  const padded = ` ${normalizeIdentityName(value)} `;
  return new Set(Array.from({ length: Math.max(0, padded.length - 1) }, (_, index) => padded.slice(index, index + 2)));
}

export function nameSimilarity(left: string, right: string) {
  const a = grams(left);
  const b = grams(right);
  if (!a.size && !b.size) return 1;
  const intersection = [...a].filter((token) => b.has(token)).length;
  return (2 * intersection) / (a.size + b.size);
}

export function matchPaymentRows(rows: PaymentImportRow[], employees: Employee[], aliases: MemberAlias[], clientId: string): PaymentImportMatch[] {
  const scopedAliases = aliases.filter((alias) => alias.client_id === clientId && !alias.deleted_at);
  return rows.map((row) => {
    const byId = row.id ? employees.find((employee) => employee.employee_number === row.id.padStart(6, "0")) : null;
    if (byId) return { ...row, employeeId: byId.id, memberId: byId.member_id, matchedBy: "id", confidence: 1, suggestedEmployeeId: byId.id, error: byId.member_id ? null : "Employee is not linked to a member." };
    const normalized = normalizeIdentityName(row.name);
    const exactName = employees.filter((employee) => normalizeIdentityName(employeeFullName(employee)) === normalized);
    if (exactName.length === 1) {
      const employee = exactName[0];
      return { ...row, employeeId: employee.id, memberId: employee.member_id, matchedBy: "name", confidence: 1, suggestedEmployeeId: employee.id, error: employee.member_id ? null : "Employee is not linked to a member." };
    }
    const exactAliases = scopedAliases.filter((alias) => alias.normalized_alias === normalized);
    if (exactAliases.length === 1) {
      const employee = employees.find((item) => item.id === exactAliases[0].employee_id) ?? null;
      return { ...row, employeeId: employee?.id ?? null, memberId: employee?.member_id ?? null, matchedBy: "alias", confidence: 1, suggestedEmployeeId: employee?.id ?? null, error: employee?.member_id ? null : "Alias points to an unavailable or non-member employee." };
    }
    if (exactAliases.length > 1 || exactName.length > 1) return { ...row, employeeId: null, memberId: null, matchedBy: null, confidence: 1, suggestedEmployeeId: null, error: "Duplicate exact name or alias. Select the correct employee before importing." };
    const ranked = employees.map((employee) => ({ employee, score: nameSimilarity(row.name, employeeFullName(employee)) })).sort((a, b) => b.score - a.score);
    const suggestion = ranked[0];
    return { ...row, employeeId: null, memberId: null, matchedBy: null, confidence: suggestion?.score ?? 0, suggestedEmployeeId: suggestion?.score >= 0.55 ? suggestion.employee.id : null, error: "No 100% match. Confirm an employee and save this name as an alias." };
  });
}
