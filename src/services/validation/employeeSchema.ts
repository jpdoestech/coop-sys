import { z } from "zod";
import { terminalEmploymentStatuses } from "../lookups/statuses";
import { governmentId } from "./governmentIdSchema";
import { isValidPlacement } from "../lookups/organization";
import { CHARACTER_LIMITS } from "../../utils/inputSanitizers";
import { beneficiariesSchema } from "./beneficiarySchema";

const nullableText = z.string().trim().max(CHARACTER_LIMITS.address, "Value is too long.").nullable().optional();
const contactNumber = z.string().trim().max(CHARACTER_LIMITS.phone, "Contact number is too long.").regex(/^[0-9+() -]*$/, "Contact number contains invalid characters.").nullable().optional();

export const employeeInputSchema = z
  .object({
    employee_number: z.string().regex(/^\d{6}$/, "Employee number must contain exactly six digits."),
    member_id: nullableText,
    religion_affiliation_id: nullableText,
    sss_number: governmentId([9], "SSS number", 11, [/^\d{2}-\d{6}-\d$/]),
    pagibig_number: governmentId([12], "PAG-IBIG MID number", 14, [/^\d{4}-\d{4}-\d{4}$/]),
    philhealth_number: governmentId([12], "PhilHealth number", 14, [/^\d{2}-\d{9}-\d$/]),
    tax_identification_number: governmentId([9, 12], "TIN", 15, [/^\d{3}-\d{3}-\d{3}$/, /^\d{3}-\d{3}-\d{3}-\d{3}$/]),
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
    employment_status_id: nullableText,
    employment_type_id: nullableText,
    date_hired: nullableText,
    date_regularized: nullableText,
    date_separated: nullableText,
    position_id: nullableText,
    department_id: nullableText,
    supervisor_id: nullableText,
    work_location: nullableText,
    notes: z.string().trim().max(CHARACTER_LIMITS.notes, "Notes are too long.").nullable().optional(),
    beneficiaries: beneficiariesSchema,
    active_assignment: z
      .object({
        id: z.string().uuid(),
        branch_id: nullableText,
        client_id: nullableText,
        assignment_code: nullableText,
        start_date: z.string().min(1, "Assignment start date is required."),
        end_date: nullableText,
        work_location: nullableText,
        transfer_reason: nullableText,
        notes: nullableText
      })
      .nullable()
  })
  .refine(
    (value) =>
      !value.active_assignment?.end_date ||
      value.active_assignment.end_date >= value.active_assignment.start_date,
    {
      message: "Assignment end date cannot be earlier than its start date.",
      path: ["active_assignment", "end_date"]
    }
  )
  .refine(
    (value) =>
      !value.active_assignment ||
      isValidPlacement(
        value.active_assignment.branch_id ?? null,
        value.active_assignment.client_id ?? null,
      ),
    {
      message: "The selected client must belong to the selected branch, and Head Office cannot have a client.",
      path: ["active_assignment", "client_id"]
    }
  )
  .refine(
    (value) => !value.date_hired || value.date_hired <= new Date().toISOString().slice(0, 10),
    {
      message: "Date hired cannot be later than today.",
      path: ["date_hired"]
    }
  )
  .refine(
    (value) =>
      !value.employment_status_id ||
      !terminalEmploymentStatuses.has(value.employment_status_id) ||
      Boolean(value.date_separated),
    {
      message: "A resignation, termination, or separation date is required.",
      path: ["date_separated"]
    }
  );

export type EmployeeInputSchema = z.infer<typeof employeeInputSchema>;
