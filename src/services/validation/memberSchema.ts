import { z } from "zod";
import { terminalMemberStatuses } from "../lookups/statuses";
import { governmentId } from "./governmentIdSchema";
import { CHARACTER_LIMITS } from "../../utils/inputSanitizers";

const nullableText = z.string().trim().max(CHARACTER_LIMITS.address, "Value is too long.").nullable().optional();
const contactNumber = z.string().trim().max(CHARACTER_LIMITS.phone, "Contact number is too long.").regex(/^[0-9+() -]*$/, "Contact number contains invalid characters.").nullable().optional();

export const memberInputSchema = z.object({
  membership_number: z.string().trim().min(1, "Membership number is required.").max(CHARACTER_LIMITS.identifier),
  first_name: z.string().trim().min(1, "First name is required.").max(CHARACTER_LIMITS.name),
  middle_name: nullableText,
  last_name: z.string().trim().min(1, "Last name is required.").max(CHARACTER_LIMITS.name),
  suffix: nullableText,
  date_of_birth: nullableText,
  sex: nullableText,
  civil_status: nullableText,
  mobile_number: contactNumber,
  email: z
    .string()
    .trim()
    .email("Email address is invalid.")
    .nullable()
    .optional()
    .or(z.literal("")),
  address: nullableText,
  barangay: nullableText,
  city_municipality: nullableText,
  province: nullableText,
  postal_code: nullableText,
  membership_date: nullableText,
  membership_status_id: nullableText,
  membership_type_id: nullableText,
  member_category: nullableText,
  religion_affiliation_id: nullableText,
  sss_number: governmentId([9], "SSS number", 11, [/^\d{2}-\d{6}-\d$/]),
  pagibig_number: governmentId([12], "PAG-IBIG MID number", 14, [/^\d{4}-\d{4}-\d{4}$/]),
  philhealth_number: governmentId([12], "PhilHealth number", 14, [/^\d{2}-\d{9}-\d$/]),
  tax_identification_number: governmentId([9, 12], "TIN", 15, [/^\d{3}-\d{3}-\d{3}$/, /^\d{3}-\d{3}-\d{3}-\d{3}$/]),
  acceptance_resolution_number: nullableText,
  highest_educational_attainment: nullableText,
  occupation_income_source: nullableText,
  annual_income: z.number().nonnegative().nullable().optional(),
  number_of_dependents: z.number().int().nonnegative().nullable().optional(),
  beneficiary_name: nullableText,
  religion_affiliation: nullableText,
  termination_date: nullableText,
  termination_reason: nullableText,
  emergency_contact: nullableText,
  notes: z.string().trim().max(CHARACTER_LIMITS.notes, "Notes are too long.").nullable().optional(),
  profile_photo_ref: nullableText
}).refine(
  (value) =>
    !value.membership_status_id ||
    !terminalMemberStatuses.has(value.membership_status_id) ||
    Boolean(value.termination_date),
  {
    message: "A resignation or termination date is required.",
    path: ["termination_date"],
  },
);

export type MemberInputSchema = z.infer<typeof memberInputSchema>;
