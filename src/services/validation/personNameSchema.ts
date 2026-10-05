import { z } from "zod";
import { CHARACTER_LIMITS, normalizeSentenceCase } from "../../utils/inputSanitizers";

export function requiredPersonName(label: string) {
  return z.string().transform(normalizeSentenceCase).pipe(z.string().min(1, `${label} is required.`).max(CHARACTER_LIMITS.name));
}

export const optionalPersonName = z.string().transform(normalizeSentenceCase).pipe(z.string().max(CHARACTER_LIMITS.name)).nullable().optional();
