import { z } from "zod";

function digitCount(value: string) {
  return value.replace(/\D/g, "").length;
}

export function governmentId(lengths: number[], label: string) {
  return z
    .string()
    .trim()
    .nullable()
    .optional()
    .refine(
      (value) => !value || lengths.includes(digitCount(value)),
      `${label} must contain ${lengths.join(" or ")} digits.`,
    );
}

