export const CHARACTER_LIMITS = {
  phone: 20,
  mobile: 11,
  name: 100,
  identifier: 50,
  address: 200,
  notes: 2000,
} as const;

export function normalizeWhitespace(value: string) {
  return value.trim().replace(/\s+/gu, " ");
}

export function normalizeProperCase(value: string) {
  return normalizeWhitespace(value)
    .toLocaleLowerCase("en-PH")
    .replace(/(^|[^\p{L}\p{M}\p{N}])\p{L}/gu, (text) => text.toLocaleUpperCase("en-PH"))
    .replace(/(?:^|\s)(?:ii|iii|iv|vi|vii|viii|ix)$/iu, (text) => text.toLocaleUpperCase("en-PH"));
}

export function sanitizePhoneNumber(value: string) {
  const cleaned = value.replace(/[^0-9+() -]/g, "");
  const firstPlus = cleaned.indexOf("+");
  const normalized = firstPlus < 0
    ? cleaned
    : cleaned.slice(0, firstPlus + 1) + cleaned.slice(firstPlus + 1).replace(/\+/g, "");
  return normalized.slice(0, CHARACTER_LIMITS.phone);
}

export function sanitizeMobileNumber(value: string) {
  return value.replace(/\D/g, "").slice(0, CHARACTER_LIMITS.mobile);
}

export const MOBILE_NUMBER_PATTERN = /^09\d{9}$/;

export function normalizeStoredMobileNumber(value: string | null | undefined) {
  if (!value) return value ?? null;
  const digits = value.replace(/\D/g, "");
  return /^639\d{9}$/.test(digits) ? `0${digits.slice(2)}` : value;
}

export type GovernmentIdKind = "sss" | "pagibig" | "philhealth" | "tin";

export const SSS_NUMBER_RULE = {
  digits: 10,
  groups: [2, 7, 1],
  maxCharacters: 12,
  placeholder: "00-0000000-0",
  pattern: /^\d{2}-\d{7}-\d$/,
} as const;

const governmentIdGroups: Record<GovernmentIdKind, readonly number[]> = {
  sss: SSS_NUMBER_RULE.groups,
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

