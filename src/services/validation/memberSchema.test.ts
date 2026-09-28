import { describe, expect, it } from "vitest";
import { memberInputSchema } from "./memberSchema";
import { MEMBER_STATUS } from "../lookups/statuses";

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
  sss_number: null,
  pagibig_number: null,
  philhealth_number: null,
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

  it("validates Philippine government number lengths", () => {
    expect(memberInputSchema.safeParse({ ...validMember, sss_number: "12-3456789-0" }).success).toBe(true);
    expect(memberInputSchema.safeParse({ ...validMember, sss_number: "123" }).success).toBe(false);
  });

  it("requires an end date for resigned or terminated membership", () => {
    expect(memberInputSchema.safeParse({ ...validMember, membership_status_id: MEMBER_STATUS.resigned }).success).toBe(false);
    expect(memberInputSchema.safeParse({ ...validMember, membership_status_id: MEMBER_STATUS.resigned, termination_date: "2026-09-28" }).success).toBe(true);
  });
});
