import type { BaseRecord, PersonName } from "./common";

export type Member = BaseRecord &
  PersonName & {
    membership_number: string;
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
    membership_date: string | null;
    membership_status_id: string | null;
    membership_type_id: string | null;
    member_category: string | null;
    religion_affiliation_id: string | null;
    tax_identification_number: string | null;
    acceptance_resolution_number: string | null;
    highest_educational_attainment: string | null;
    occupation_income_source: string | null;
    annual_income: number | null;
    number_of_dependents: number | null;
    beneficiary_name: string | null;
    religion_affiliation: string | null;
    termination_date: string | null;
    termination_reason: string | null;
    emergency_contact: string | null;
    notes: string | null;
    profile_photo_ref: string | null;
  };

export type MemberInput = Omit<
  Member,
  "id" | "created_at" | "updated_at" | "deleted_at" | "sync_status"
>;
