import type { BaseRecord, PersonName } from "./common";
import type { Beneficiary, BeneficiaryInput } from "./beneficiary";
import type { EmploymentAssignment, EmploymentAssignmentInput } from "./assignment";

export type Employee = BaseRecord &
  PersonName & {
    employee_number: string;
    member_id: string | null;
    religion_affiliation_id: string | null;
    date_of_birth: string | null;
    sex: string | null;
    civil_status: string | null;
    mobile_number: string | null;
    email: string | null;
    address: string | null;
    barangay: string | null;
    city_municipality: string | null;
    province: string | null;
    postal_code: string | null;
    employment_status_id: string | null;
    employment_type_id: string | null;
    date_hired: string | null;
    date_regularized: string | null;
    date_separated: string | null;
    position_id: string | null;
    department_id: string | null;
    supervisor_id: string | null;
    work_location: string | null;
    notes: string | null;
    beneficiaries: Beneficiary[];
    active_assignment: EmploymentAssignment | null;
  };

export type EmployeeInput = Omit<
  Employee,
  "id" | "created_at" | "updated_at" | "deleted_at" | "sync_status" | "beneficiaries" | "active_assignment"
> & {
  beneficiaries: BeneficiaryInput[];
  active_assignment: EmploymentAssignmentInput | null;
};
