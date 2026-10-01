import { describe, expect, it } from "vitest";
import type { EmployeeInput } from "../../types/employee";
import { newMemberFromEmployee, ASSOCIATE_MEMBER_TYPE_ID, employeeProfileFromMember, memberProfileFromEmployee } from "./personProfileSync";
import { EMPLOYMENT_STATUS, MEMBER_STATUS } from "../lookups/statuses";
import type { Member } from "../../types/member";

const employee = {
  first_name: "Ana",
  middle_name: "D.",
  last_name: "Sample",
  suffix: null,
  date_of_birth: "1990-01-01",
  sex: "Female",
  civil_status: "Single",
  mobile_number: "+639170000000",
  email: "ana@example.test",
  address: "1 Sample Street",
  barangay: "Bago Aplaya",
  city_municipality: "Davao City",
  province: "Davao del Sur",
  postal_code: "8000",
  religion_affiliation_id: null,
  sss_number: "12-345678-9",
  pagibig_number: "1234-5678-9012",
  philhealth_number: "12-345678901-2",
  tax_identification_number: "123-456-789-000",
  date_hired: "2026-09-28",
  beneficiaries: [],
} as unknown as EmployeeInput;

describe("newMemberFromEmployee", () => {
  it("copies shared identity but starts a new Associate membership lifecycle", () => {
    const member = newMemberFromEmployee(employee, "001000");

    expect(member.membership_number).toBe("001000");
    expect(member.membership_type_id).toBe(ASSOCIATE_MEMBER_TYPE_ID);
    expect(member.bod_approval_status).toBe("pending");
    expect(member.tax_identification_number).toBe(employee.tax_identification_number);
    expect(member).not.toHaveProperty("date_hired");
  });

  it("synchronizes lifecycle status and separation dates in both directions", () => {
    const member = { membership_status_id: MEMBER_STATUS.resigned, termination_date: "2026-09-30", beneficiaries: [] } as unknown as Member;
    expect(employeeProfileFromMember(member)).toMatchObject({ employment_status_id: EMPLOYMENT_STATUS.resigned, date_separated: "2026-09-30" });
    expect(memberProfileFromEmployee({ ...employee, employment_status_id: EMPLOYMENT_STATUS.terminated, date_separated: "2026-10-01" })).toMatchObject({ membership_status_id: MEMBER_STATUS.terminated, termination_date: "2026-10-01" });
  });
});

