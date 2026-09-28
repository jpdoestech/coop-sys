export type Beneficiary = {
  id: string;
  full_name: string;
  relationship: string;
  date_of_birth: string | null;
  contact_number: string | null;
  is_active: boolean;
  deactivated_at: string | null;
  deactivation_reason: string | null;
};

export type BeneficiaryInput = Omit<Beneficiary, "deactivated_at">;

export function activeBeneficiaryCount(beneficiaries: BeneficiaryInput[]) {
  return beneficiaries.filter((beneficiary) => beneficiary.is_active).length;
}
