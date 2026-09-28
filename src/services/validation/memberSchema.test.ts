import { describe, expect, it } from "vitest";
import { memberInputSchema } from "./memberSchema";

const validMember = {
  membership_number: "MEM-0001",
  first_name: "Amara",
  middle_name: null,
  last_name: "Santos",
  suffix: null,
  date_of_birth: "1992-02-12",
  sex: "Female",
  civil_status: "Single",
  mobile_number: null,
  email: "amara@example.test",
  address: null,
  barangay: null,
  city_municipality: null,
  province: null,
  postal_code: null,
  membership_date: "2026-01-12",
  membership_status_id: null,
  membership_type_id: null,
  member_category: "Manpower",
  religion_affiliation_id: null,
  tax_identification_number: null,
  acceptance_resolution_number: null,
  highest_educational_attainment: null,
  occupation_income_source: null,
  annual_income: 300000,
  number_of_dependents: 2,
  beneficiary_name: null,
  religion_affiliation: null,
  termination_date: null,
  termination_reason: null,
  emergency_contact: null,
  notes: null,
  profile_photo_ref: null
};

describe("memberInputSchema", () => {
  it("accepts extended member registration details", () => {
    expect(memberInputSchema.safeParse(validMember).success).toBe(true);
  });

  it("rejects negative annual income", () => {
    expect(memberInputSchema.safeParse({ ...validMember, annual_income: -1 }).success).toBe(false);
  });

  it("requires a whole non-negative dependent count", () => {
    expect(memberInputSchema.safeParse({ ...validMember, number_of_dependents: 1.5 }).success).toBe(false);
  });
});
