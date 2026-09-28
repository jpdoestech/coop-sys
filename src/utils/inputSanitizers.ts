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

export function sanitizeGovernmentId(value: string, maxLength: number) {
  return value.replace(/[^0-9-]/g, "").slice(0, maxLength);
}

