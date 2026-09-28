import { z } from "zod";

const nullableText = z.string().trim().nullable().optional();

export const employeeInputSchema = z
  .object({
    employee_number: z.string().trim().min(1, "Employee number is required."),
    member_id: nullableText,
    religion_affiliation_id: nullableText,
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
    employment_status_id: nullableText,
    employment_type_id: nullableText,
    date_hired: nullableText,
    date_regularized: nullableText,
    date_separated: nullableText,
    position_id: nullableText,
    department_id: nullableText,
    supervisor_id: nullableText,
    work_location: nullableText,
    notes: nullableText,
    beneficiaries: z
      .array(
        z
          .object({
            id: z.string().uuid(),
            full_name: z.string().trim().min(1, "Beneficiary name is required."),
            relationship: z.string().trim().min(1, "Relationship is required."),
            date_of_birth: nullableText,
            contact_number: nullableText,
            is_active: z.boolean(),
            deactivation_reason: nullableText
          })
          .refine(
            (beneficiary) => beneficiary.is_active || Boolean(beneficiary.deactivation_reason),
            {
              message: "A deactivation reason is required.",
              path: ["deactivation_reason"]
            }
          )
      ),
    active_assignment: z
      .object({
        id: z.string().uuid(),
        branch_id: nullableText,
        client_id: nullableText,
        assignment_code: nullableText,
        start_date: z.string().min(1, "Assignment start date is required."),
        end_date: nullableText,
        work_location: nullableText,
        notes: nullableText
      })
      .nullable()
  })
  .refine(
    (value) => value.beneficiaries.filter((beneficiary) => beneficiary.is_active).length <= 3,
    {
      message: "A maximum of three active beneficiaries is allowed.",
      path: ["beneficiaries"]
    }
  )
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
    (value) => !value.date_hired || value.date_hired <= new Date().toISOString().slice(0, 10),
    {
      message: "Date hired cannot be later than today.",
      path: ["date_hired"]
    }
  );

export type EmployeeInputSchema = z.infer<typeof employeeInputSchema>;
