import { describe, expect, it } from "vitest";
import { employeeInputSchema } from "./employeeSchema";

const baseEmployee = {
  employee_number: "EMP-000001",
  member_id: null,
  religion_affiliation_id: null,
  first_name: "Ada",
  middle_name: null,
  last_name: "Santos",
  suffix: null,
  date_of_birth: null,
  sex: null,
  civil_status: null,
  mobile_number: null,
  email: "ada@example.test",
  address: null,
  barangay: null,
  city_municipality: null,
  province: null,
  postal_code: null,
  employment_status_id: null,
  employment_type_id: null,
  date_hired: "2026-01-15",
  date_regularized: null,
  date_separated: null,
  position_id: null,
  department_id: null,
  supervisor_id: null,
  work_location: null,
  notes: null,
  beneficiaries: [],
  active_assignment: null
};

describe("employeeInputSchema", () => {
  it("accepts a valid employee", () => {
    expect(employeeInputSchema.safeParse(baseEmployee).success).toBe(true);
  });

  it("requires an employee number", () => {
    const result = employeeInputSchema.safeParse({ ...baseEmployee, employee_number: "" });
    expect(result.success).toBe(false);
  });

  it("rejects future hire dates", () => {
    const result = employeeInputSchema.safeParse({ ...baseEmployee, date_hired: "2999-01-01" });
    expect(result.success).toBe(false);
  });

  it("rejects more than three active beneficiaries", () => {
    const beneficiaries = Array.from({ length: 4 }, (_, index) => ({
      id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
      full_name: `Dependent ${index}`,
      relationship: "Child",
      date_of_birth: null,
      contact_number: null,
      is_active: true,
      deactivation_reason: null
    }));
    expect(employeeInputSchema.safeParse({ ...baseEmployee, beneficiaries }).success).toBe(false);
  });

  it("requires a reason when a beneficiary is deactivated", () => {
    const beneficiaries = [{
      id: "00000000-0000-4000-8000-000000000001",
      full_name: "Dependent One",
      relationship: "Child",
      date_of_birth: null,
      contact_number: null,
      is_active: false,
      deactivation_reason: null
    }];
    expect(employeeInputSchema.safeParse({ ...baseEmployee, beneficiaries }).success).toBe(false);
  });
});
