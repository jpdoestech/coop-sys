import type { Member } from "../../types/member";

const timestamp = "2026-09-01T08:00:00.000Z";

function member(
  index: number,
  firstName: string,
  lastName: string,
  typeId: string,
  statusId = "31000000-0000-4000-8000-000000000001"
): Member {
  const sequence = String(index).padStart(6, "0");

  return {
    id: `70000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    membership_number: sequence,
    first_name: firstName,
    middle_name: null,
    last_name: lastName,
    suffix: null,
    date_of_birth: `199${index}-0${Math.min(index, 9)}-15`,
    sex: index % 2 === 0 ? "Female" : "Male",
    civil_status: index % 3 === 0 ? "Married" : "Single",
    mobile_number: `+63917000${sequence}`,
    email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@example.test`,
    address: `${index} Mabini Street`,
    barangay: "San Roque",
    city_municipality: "Davao City",
    province: "Davao del Sur",
    postal_code: "8000",
    membership_date: `202${index % 5}-0${Math.min(index, 9)}-01`,
    membership_status_id: statusId,
    membership_type_id: typeId,
    member_category: index % 2 === 0 ? "Manpower" : "Community",
    religion_affiliation_id: `35000000-0000-4000-8000-00000000000${(index % 8) + 1}`,
    sss_number: null,
    pagibig_number: null,
    philhealth_number: null,
    tax_identification_number: `000-000-${String(index).padStart(3, "0")}-000`,
    acceptance_resolution_number: index === 6 ? null : sequence,
    acceptance_date: index === 6 ? null : `202${index % 5}-0${Math.min(index, 9)}-01`,
    bod_approval_status: index === 6 ? "pending" : "approved",
    highest_educational_attainment: index % 2 === 0 ? "College Graduate" : "Senior High School",
    occupation_income_source: index % 2 === 0 ? "Agency employee" : "Self-employed",
    annual_income: 240000 + index * 18000,
    number_of_dependents: index <= 3 ? 1 : 0,
    beneficiary_name: null,
    religion_affiliation: null,
    termination_date: null,
    termination_reason: null,
    emergency_contact: `Emergency Contact ${sequence}`,
    notes: null,
    profile_photo_ref: null,
    beneficiaries: index <= 3 ? [{
      id: `90000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
      full_name: `Dependent ${sequence}`,
      relationship: "Child",
      date_of_birth: `201${index}-01-01`,
      contact_number: null,
      is_active: true,
      deactivated_at: null,
      deactivation_reason: null,
    }] : [],
    created_at: timestamp,
    updated_at: timestamp,
    deleted_at: null,
    sync_status: "synced"
  };
}

export const developmentMembers: Member[] = [
  member(1, "Amara", "Santos", "30000000-0000-4000-8000-000000000001"),
  member(2, "Nico", "Reyes", "30000000-0000-4000-8000-000000000001"),
  member(3, "Leah", "Villanueva", "30000000-0000-4000-8000-000000000002"),
  member(4, "Paolo", "Mendoza", "30000000-0000-4000-8000-000000000003"),
  member(5, "Mira", "Flores", "30000000-0000-4000-8000-000000000001"),
  member(
    6,
    "Tomas",
    "Navarro",
    "30000000-0000-4000-8000-000000000002",
    "31000000-0000-4000-8000-000000000002"
  )
];
