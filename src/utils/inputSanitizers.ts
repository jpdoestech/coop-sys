export const CHARACTER_LIMITS = {
  phone: 20,
  name: 100,
  identifier: 50,
  address: 200,
  notes: 2000,
} as const;

export function sanitizePhoneNumber(value: string) {
  const cleaned = value.replace(/[^0-9+() -]/g, "");
  const firstPlus = cleaned.indexOf("+");
  const normalized = firstPlus < 0
    ? cleaned
    : cleaned.slice(0, firstPlus + 1) + cleaned.slice(firstPlus + 1).replace(/\+/g, "");
  return normalized.slice(0, CHARACTER_LIMITS.phone);
}

export type GovernmentIdKind = "sss" | "pagibig" | "philhealth" | "tin";

const governmentIdGroups: Record<GovernmentIdKind, number[]> = {
  sss: [2, 6, 1],
  pagibig: [4, 4, 4],
  philhealth: [2, 9, 1],
  tin: [3, 3, 3, 3],
};

export function sanitizeGovernmentId(value: string, kind: GovernmentIdKind) {
  const groups = governmentIdGroups[kind];
  const maximumDigits = groups.reduce((total, length) => total + length, 0);
  const digits = value.replace(/\D/g, "").slice(0, maximumDigits);
  const parts: string[] = [];
  let offset = 0;
  for (const length of groups) {
    const part = digits.slice(offset, offset + length);
    if (!part) break;
    parts.push(part);
    offset += length;
  }
  return parts.join("-");
}

