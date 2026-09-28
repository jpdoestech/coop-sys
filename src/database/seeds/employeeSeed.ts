import type { Employee } from "../../types/employee";

const timestamp = "2026-09-01T08:00:00.000Z";

function employee(
  index: number,
  firstName: string,
  lastName: string,
  employmentStatusId = "33000000-0000-4000-8000-000000000001",
): Employee {
  const sequence = String(index).padStart(4, "0");
  const departmentIndex = ((index - 1) % 5) + 1;
  const positionIndex = ((index - 1) % 10) + 1;
  const branchIndex = index % 2 === 0 ? 2 : 1;
  const clientIndex = index % 2 === 0 ? 2 : 1;
  const isActive = employmentStatusId === "33000000-0000-4000-8000-000000000001";
  const isHeadOffice = index % 4 === 1;
  const assignment = {
    id: `91000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    branch_id: isHeadOffice
      ? "60000000-0000-4000-8000-000000000000"
      : `60000000-0000-4000-8000-00000000000${branchIndex}`,
    client_id: isHeadOffice
      ? null
      : `61000000-0000-4000-8000-00000000000${clientIndex}`,
    assignment_code: `ASN-${sequence}`,
    start_date: "2025-01-15",
    end_date: isActive ? null : "2026-08-31",
    work_location: isHeadOffice
      ? "Head Office"
      : branchIndex === 1 ? "Davao Site" : "General Santos Site",
    transfer_reason: null,
    notes: null,
  };

  return {
    id: `80000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    employee_number: `EMP-${sequence}`,
    member_id: index <= 6 ? `70000000-0000-4000-8000-${String(index).padStart(12, "0")}` : null,
    religion_affiliation_id: `35000000-0000-4000-8000-00000000000${(index % 8) + 1}`,
    sss_number: null,
    pagibig_number: null,
    philhealth_number: null,
    tax_identification_number: index <= 6 ? `000-000-${sequence}-000` : null,
    first_name: firstName,
    middle_name: null,
    last_name: lastName,
    suffix: null,
    date_of_birth: `199${index}-0${Math.min(index, 9)}-10`,
    sex: index % 2 === 0 ? "Female" : "Male",
    civil_status: index % 3 === 0 ? "Married" : "Single",
    mobile_number: `+63918000${sequence}`,
    email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@example.test`,
    address: `${index} Bonifacio Street`,
    barangay: "Poblacion",
    city_municipality: "Davao City",
    province: "Davao del Sur",
    postal_code: "8000",
    employment_status_id: employmentStatusId,
    employment_type_id:
      index % 4 === 0
        ? "32000000-0000-4000-8000-000000000002"
        : "32000000-0000-4000-8000-000000000001",
    date_hired: `202${index % 5}-0${Math.min(index, 9)}-15`,
    date_regularized: null,
    date_separated:
      employmentStatusId === "33000000-0000-4000-8000-000000000001"
        ? null
        : "2026-08-31",
    position_id: `20000000-0000-4000-8000-${String(positionIndex).padStart(12, "0")}`,
    department_id: `10000000-0000-4000-8000-${String(departmentIndex).padStart(12, "0")}`,
    supervisor_id: null,
    work_location: assignment.work_location,
    notes: null,
    beneficiaries: index <= 3 ? [
      {
        id: `90000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
        full_name: `Dependent ${sequence}`,
        relationship: "Child",
        date_of_birth: `201${index}-01-01`,
        contact_number: null,
        is_active: true,
        deactivated_at: null,
        deactivation_reason: null
      }
    ] : [],
    active_assignment: isActive ? assignment : null,
    assignment_history: [assignment],
    created_at: timestamp,
    updated_at: timestamp,
    deleted_at: null,
    sync_status: "synced"
  };
}

export const developmentEmployees: Employee[] = [
  employee(1, "Amara", "Santos"),
  employee(2, "Nico", "Reyes"),
  employee(3, "Leah", "Villanueva"),
  employee(4, "Paolo", "Mendoza"),
  employee(5, "Mira", "Flores"),
  employee(6, "Tomas", "Navarro", "33000000-0000-4000-8000-000000000006"),
  employee(7, "Elena", "Cruz"),
  employee(8, "Marco", "Aquino")
];
