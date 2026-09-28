import { z } from "zod";
import { CHARACTER_LIMITS } from "../../utils/inputSanitizers";

const nullableText = z.string().trim().max(CHARACTER_LIMITS.address, "Value is too long.").nullable().optional();
const contactNumber = z.string().trim().max(CHARACTER_LIMITS.phone, "Contact number is too long.").regex(/^[0-9+() -]*$/, "Contact number contains invalid characters.").nullable().optional();

export const beneficiaryInputSchema = z
  .object({
    id: z.string().uuid(),
    full_name: z.string().trim().min(1, "Beneficiary name is required.").max(CHARACTER_LIMITS.name),
    relationship: z.string().trim().min(1, "Relationship is required.").max(CHARACTER_LIMITS.name),
    date_of_birth: nullableText,
    contact_number: contactNumber,
    is_active: z.boolean(),
    deactivation_reason: nullableText,
  })
  .refine((beneficiary) => beneficiary.is_active || Boolean(beneficiary.deactivation_reason), {
    message: "A deactivation reason is required.",
    path: ["deactivation_reason"],
  });

export const beneficiariesSchema = z
  .array(beneficiaryInputSchema)
  .refine((beneficiaries) => beneficiaries.filter((beneficiary) => beneficiary.is_active).length <= 3, {
    message: "A maximum of three active beneficiaries is allowed.",
  });
