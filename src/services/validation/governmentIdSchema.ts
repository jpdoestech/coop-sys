import { z } from "zod";

function digitCount(value: string) {
  return value.replace(/\D/g, "").length;
}

export function governmentId(lengths: number[], label: string, maxCharacters: number, formats: RegExp[]) {
  return z
    .string()
    .trim()
    .nullable()
    .optional()
    .refine((value) => !value || value.length <= maxCharacters, `${label} is too long.`)
    .refine(
      (value) => !value || formats.some((format) => format.test(value)),
      `${label} format is invalid.`,
    )
    .refine(
      (value) => !value || lengths.includes(digitCount(value)),
      `${label} must contain ${lengths.join(" or ")} digits.`,
    );
}

