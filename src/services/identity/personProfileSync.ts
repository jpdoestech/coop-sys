import type { EmployeeInput } from "../../types/employee";
import type { Member, MemberInput } from "../../types/member";
import { MEMBER_STATUS } from "../lookups/statuses";

export const ASSOCIATE_MEMBER_TYPE_ID = "30000000-0000-4000-8000-000000000002";

export function employeeProfileFromMember(member: Member): Partial<EmployeeInput> {
  return {
    member_id: member.id,
    first_name: member.first_name,
    middle_name: member.middle_name,
    last_name: member.last_name,
    suffix: member.suffix,
    date_of_birth: member.date_of_birth,
    sex: member.sex,
    civil_status: member.civil_status,
    mobile_number: member.mobile_number,
    email: member.email,
    address: member.address,
    barangay: member.barangay,
    city_municipality: member.city_municipality,
    province: member.province,
    postal_code: member.postal_code,
    religion_affiliation_id: member.religion_affiliation_id,
    sss_number: member.sss_number,
    pagibig_number: member.pagibig_number,
    philhealth_number: member.philhealth_number,
    tax_identification_number: member.tax_identification_number,
  };
}

export function governmentIdsFromEmployee(employee: EmployeeInput): Partial<MemberInput> {
  return {
    sss_number: employee.sss_number,
    pagibig_number: employee.pagibig_number,
    philhealth_number: employee.philhealth_number,
    tax_identification_number: employee.tax_identification_number,
  };
}

export function newMemberFromEmployee(
  employee: EmployeeInput,
  membershipNumber: string,
): MemberInput {
  return {
    membership_number: membershipNumber,
    first_name: employee.first_name,
    middle_name: employee.middle_name,
    last_name: employee.last_name,
    suffix: employee.suffix,
    date_of_birth: employee.date_of_birth,
    sex: employee.sex,
    civil_status: employee.civil_status,
    mobile_number: employee.mobile_number,
    email: employee.email,
    address: employee.address,
    barangay: employee.barangay,
    city_municipality: employee.city_municipality,
    province: employee.province,
    postal_code: employee.postal_code,
    membership_date: new Date().toISOString().slice(0, 10),
    membership_status_id: MEMBER_STATUS.active,
    membership_type_id: ASSOCIATE_MEMBER_TYPE_ID,
    member_category: "Manpower",
    religion_affiliation_id: employee.religion_affiliation_id,
    sss_number: employee.sss_number,
    pagibig_number: employee.pagibig_number,
    philhealth_number: employee.philhealth_number,
    tax_identification_number: employee.tax_identification_number,
    acceptance_resolution_number: null,
    highest_educational_attainment: null,
    occupation_income_source: "Employed / Salary",
    annual_income: null,
    number_of_dependents: null,
    beneficiary_name: null,
    religion_affiliation: null,
    termination_date: null,
    termination_reason: null,
    emergency_contact: null,
    notes: null,
    profile_photo_ref: null,
  };
}

