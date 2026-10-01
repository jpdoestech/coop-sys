import type { EmployeeInput } from "../../types/employee";
import type { Member, MemberInput } from "../../types/member";
import { EMPLOYMENT_STATUS, MEMBER_STATUS } from "../lookups/statuses";

export const ASSOCIATE_MEMBER_TYPE_ID = "30000000-0000-4000-8000-000000000002";

export function employmentStatusFromMember(status: string | null) {
  if (status === MEMBER_STATUS.active) return EMPLOYMENT_STATUS.active;
  if (status === MEMBER_STATUS.resigned) return EMPLOYMENT_STATUS.resigned;
  if (status === MEMBER_STATUS.terminated) return EMPLOYMENT_STATUS.terminated;
  if (status === MEMBER_STATUS.inactive) return EMPLOYMENT_STATUS.inactive;
  return null;
}

export function memberStatusFromEmployee(status: string | null) {
  if (status === EMPLOYMENT_STATUS.active || status === EMPLOYMENT_STATUS.onLeave) return MEMBER_STATUS.active;
  if (status === EMPLOYMENT_STATUS.resigned) return MEMBER_STATUS.resigned;
  if (status === EMPLOYMENT_STATUS.terminated) return MEMBER_STATUS.terminated;
  if (status === EMPLOYMENT_STATUS.inactive || status === EMPLOYMENT_STATUS.separated || status === EMPLOYMENT_STATUS.retired) return MEMBER_STATUS.inactive;
  return null;
}

export function employeeProfileFromMember(member: Member): Partial<EmployeeInput> {
  return {
    employee_number: member.membership_number,
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
    employment_status_id: employmentStatusFromMember(member.membership_status_id),
    date_separated: member.termination_date,
    beneficiaries: member.beneficiaries.map((beneficiary) => ({
      id: beneficiary.id,
      full_name: beneficiary.full_name,
      relationship: beneficiary.relationship,
      date_of_birth: beneficiary.date_of_birth,
      contact_number: beneficiary.contact_number,
      is_active: beneficiary.is_active,
      deactivation_reason: beneficiary.deactivation_reason,
    })),
  };
}

export function memberProfileFromEmployee(employee: EmployeeInput): Partial<MemberInput> {
  return {
    membership_number: employee.employee_number,
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
    religion_affiliation_id: employee.religion_affiliation_id,
    sss_number: employee.sss_number,
    pagibig_number: employee.pagibig_number,
    philhealth_number: employee.philhealth_number,
    tax_identification_number: employee.tax_identification_number,
    membership_status_id: memberStatusFromEmployee(employee.employment_status_id),
    termination_date: employee.date_separated,
    number_of_dependents: employee.beneficiaries.filter((beneficiary) => beneficiary.is_active).length,
    beneficiaries: employee.beneficiaries,
  };
}

export const governmentIdsFromEmployee = memberProfileFromEmployee;

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
    membership_status_id: MEMBER_STATUS.inactive,
    membership_type_id: ASSOCIATE_MEMBER_TYPE_ID,
    member_category: "Manpower",
    religion_affiliation_id: employee.religion_affiliation_id,
    sss_number: employee.sss_number,
    pagibig_number: employee.pagibig_number,
    philhealth_number: employee.philhealth_number,
    tax_identification_number: employee.tax_identification_number,
    acceptance_resolution_number: null,
    acceptance_date: null,
    bod_approval_status: "pending",
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
    beneficiaries: employee.beneficiaries,
  };
}

