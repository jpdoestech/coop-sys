import { z } from "zod";
import { CHARACTER_LIMITS, normalizeProperCase } from "../../utils/inputSanitizers";

export function requiredPersonName(label: string) {
  return z.string().transform(normalizeProperCase).pipe(z.string().min(1, `${label} is required.`).max(CHARACTER_LIMITS.name));
}

export const optionalPersonName = z.string().transform(normalizeProperCase).pipe(z.string().max(CHARACTER_LIMITS.name)).nullable().optional();
