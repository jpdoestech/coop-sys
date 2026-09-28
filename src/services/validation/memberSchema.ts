import { z } from "zod";

const nullableText = z.string().trim().nullable().optional();

export const memberInputSchema = z.object({
  membership_number: z.string().trim().min(1, "Membership number is required."),
  first_name: z.string().trim().min(1, "First name is required."),
  middle_name: nullableText,
  last_name: z.string().trim().min(1, "Last name is required."),
  suffix: nullableText,
  date_of_birth: nullableText,
  sex: nullableText,
  civil_status: nullableText,
  mobile_number: nullableText,
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
  tax_identification_number: nullableText,
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
  notes: nullableText,
  profile_photo_ref: nullableText
});

export type MemberInputSchema = z.infer<typeof memberInputSchema>;
