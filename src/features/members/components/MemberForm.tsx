import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { BriefcaseBusiness, Contact, MapPinned, Save, UserRound, UsersRound, X } from "lucide-react";
import { AddressFields, type AddressValue } from "../../../components/forms/AddressFields";
import { GovernmentIdFields, type GovernmentIdValue } from "../../../components/forms/GovernmentIdFields";
import { educationalAttainments } from "../../../services/lookups/educationalAttainments";
import { terminalMemberStatuses } from "../../../services/lookups/statuses";
import { memberInputSchema } from "../../../services/validation/memberSchema";
import { religionAffiliations } from "../../../services/lookups/religionAffiliations";
import type { Member, MemberInput } from "../../../types/member";
import { memberStatuses, memberTypes } from "../data/memberOptions";
import { CHARACTER_LIMITS, sanitizePhoneNumber } from "../../../utils/inputSanitizers";
import { BeneficiaryEditor } from "../../../components/forms/BeneficiaryEditor";
import { activeBeneficiaryCount } from "../../../types/beneficiary";
import { useOrganization } from "../../../services/organization/useOrganization";

type Draft = Omit<MemberInput, "annual_income" | "number_of_dependents"> & {
  annual_income: string;
  number_of_dependents: string;
};

type MemberTab = "personal" | "contact" | "membership" | "background" | "beneficiaries";

type MemberFormProps = {
  member: Member | null;
  suggestedNumber: string;
  saving: boolean;
  aliasEditor?: ReactNode;
  canViewSensitive?: boolean;
  canEditSensitive?: boolean;
  onCancel: () => void;
  onSubmit: (input: MemberInput) => void;
};

const inputClass =
  "control mt-1.5 w-full";

function emptyDraft(suggestedNumber = ""): Draft {
  return {
    membership_number: suggestedNumber,
    first_name: "",
    middle_name: null,
    last_name: "",
    suffix: null,
    date_of_birth: null,
    sex: null,
    civil_status: null,
    mobile_number: null,
    email: null,
    address: null,
    barangay: null,
    city_municipality: null,
    province: null,
    postal_code: null,
    membership_date: null,
    membership_status_id: memberStatuses[1].id,
    membership_type_id: memberTypes[1].id,
    member_category: null,
    proposed_branch_id: null,
    proposed_client_id: null,
    religion_affiliation_id: null,
    sss_number: null,
    pagibig_number: null,
    philhealth_number: null,
    tax_identification_number: null,
    acceptance_resolution_number: null,
    acceptance_date: null,
    bod_approval_status: "pending",
    highest_educational_attainment: null,
    occupation_income_source: "Employed / Salary",
    annual_income: "",
    number_of_dependents: "",
    beneficiary_name: null,
    religion_affiliation: null,
    termination_date: null,
    termination_reason: null,
    emergency_contact: null,
    notes: null,
    profile_photo_ref: null,
    beneficiaries: [],
  };
}

function toDraft(member: Member | null, suggestedNumber = ""): Draft {
  if (!member) return emptyDraft(suggestedNumber);
  const recordFields = new Set(["id", "created_at", "updated_at", "deleted_at", "sync_status"]);
  const input = Object.fromEntries(
    Object.entries(member).filter(([field]) => !recordFields.has(field))
  ) as unknown as MemberInput;
  return {
    ...input,
    annual_income: input.annual_income?.toString() ?? "",
    number_of_dependents: input.number_of_dependents?.toString() ?? ""
  };
}

function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <label className="block text-xs font-semibold text-ink/75">
      {label}
      {children}
      {error ? <span className="mt-1 block text-xs font-normal text-red-700">{error}</span> : null}
    </label>
  );
}

function Section({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <section className="border-t border-line px-6 py-5 sm:px-8">
      <div className="mb-4 sm:flex sm:items-start sm:justify-between sm:gap-6">
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
        <p className="mt-1 max-w-md text-xs leading-5 text-ink/55 sm:mt-0 sm:text-right">{description}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

export function MemberForm({ member, suggestedNumber, saving, aliasEditor, canViewSensitive = true, canEditSensitive = true, onCancel, onSubmit }: MemberFormProps) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(member, suggestedNumber));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [tab, setTab] = useState<MemberTab>("personal");
  const { branches, clients } = useOrganization();
  const availableClients = clients.filter((client) => client.branchId === draft.proposed_branch_id && client.isActive);
  const addressValue: AddressValue = {
    address: draft.address,
    barangay: draft.barangay,
    city_municipality: draft.city_municipality,
    province: draft.province,
    postal_code: draft.postal_code,
  };
  const governmentIdValue: GovernmentIdValue = {
    sss_number: draft.sss_number,
    pagibig_number: draft.pagibig_number,
    philhealth_number: draft.philhealth_number,
    tax_identification_number: draft.tax_identification_number,
  };
  const membershipEnded = Boolean(
    draft.membership_status_id && terminalMemberStatuses.has(draft.membership_status_id),
  );

  useEffect(() => {
    setDraft(toDraft(member, suggestedNumber));
    setErrors({});
    setTab("personal");
  }, [member, suggestedNumber]);

  function setValue<K extends keyof Draft>(field: K, value: Draft[K]) {
    setDraft((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: "" }));
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.proposed_branch_id) {
      setErrors((current) => ({ ...current, proposed_branch_id: "Select the intended office or branch before saving." }));
      setTab("membership");
      return;
    }
    const result = memberInputSchema.safeParse({
      ...draft,
      annual_income: draft.annual_income === "" ? null : Number(draft.annual_income),
      number_of_dependents: activeBeneficiaryCount(draft.beneficiaries),
    });

    if (!result.success) {
      const fieldErrors = result.error.flatten().fieldErrors;
      setErrors(
        Object.fromEntries(
          Object.entries(fieldErrors).map(([field, messages]) => [field, messages?.[0] ?? "Invalid value"])
        )
      );
      const firstField = result.error.issues[0]?.path[0];
      if (["mobile_number", "email", "address", "barangay", "city_municipality", "province", "postal_code", "emergency_contact"].includes(String(firstField))) setTab("contact");
      else if (["membership_date", "membership_status_id", "membership_type_id", "member_category", "proposed_branch_id", "proposed_client_id", "acceptance_resolution_number", "termination_date"].includes(String(firstField))) setTab("membership");
      else if (["occupation_income_source", "annual_income", "notes"].includes(String(firstField))) setTab("background");
      else if (firstField === "beneficiaries") setTab("beneficiaries");
      else setTab("personal");
      return;
    }

    onSubmit(result.data as MemberInput);
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-ink/35" role="presentation">
      <div className="h-full w-full max-w-3xl overflow-y-auto bg-white shadow-panel" role="dialog" aria-modal="true" aria-labelledby="member-form-title">
        <form onSubmit={submit}>
          <header className="sticky top-0 z-10 flex items-start justify-between border-b border-line bg-paper/95 px-6 py-5 backdrop-blur sm:px-8">
            <div>
              <p className="text-xs font-semibold uppercase text-clay">Member record</p>
              <h2 id="member-form-title" className="mt-1 font-display text-2xl font-semibold text-ink">
                {member ? "Edit member" : "New member"}
              </h2>
            </div>
            <button type="button" className="focus-ring rounded p-2 text-ink/65 hover:bg-white" onClick={onCancel} aria-label="Close member form">
              <X className="h-5 w-5" />
            </button>
          </header>

          <nav className="sticky top-[85px] z-10 flex gap-1 overflow-x-auto border-b border-line bg-white px-4 pt-2 sm:px-8" aria-label="Member information sections">
            {([
              ["personal", "Personal", UserRound],
              ["contact", "Contact", Contact],
              ["membership", "Membership & placement", MapPinned],
              ["background", "Background", BriefcaseBusiness],
              ["beneficiaries", "Beneficiaries", UsersRound],
            ] as const).map(([id, label, Icon]) => <button key={id} type="button" onClick={() => setTab(id)} aria-current={tab === id ? "page" : undefined} className={`flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-xs font-semibold ${tab === id ? "border-moss text-moss" : "border-transparent text-ink/50 hover:text-ink"}`}><Icon className="h-3.5 w-3.5" />{label}</button>)}
          </nav>

          {tab === "personal" ? <><Section title="Identity" description="Core details shared with an employee profile when this person has both roles.">
            <Field label="Membership number" error={errors.membership_number}>
              <input className={`${inputClass} bg-paper font-mono`} value={draft.membership_number} readOnly aria-readonly="true" />
            </Field>
            <Field label="First name" error={errors.first_name}>
              <input className={inputClass} value={draft.first_name} onChange={(event) => setValue("first_name", event.target.value)} />
            </Field>
            <Field label="Last name" error={errors.last_name}>
              <input className={inputClass} value={draft.last_name} onChange={(event) => setValue("last_name", event.target.value)} />
            </Field>
            <Field label="Middle name">
              <input className={inputClass} value={draft.middle_name ?? ""} onChange={(event) => setValue("middle_name", event.target.value || null)} />
            </Field>
            <Field label="Suffix">
              <input className={inputClass} value={draft.suffix ?? ""} onChange={(event) => setValue("suffix", event.target.value || null)} placeholder="Jr., III" />
            </Field>
            <Field label="Date of birth">
              <input type="date" className={inputClass} value={draft.date_of_birth ?? ""} onChange={(event) => setValue("date_of_birth", event.target.value || null)} />
            </Field>
            <Field label="Sex">
              <select className={inputClass} value={draft.sex ?? ""} onChange={(event) => setValue("sex", event.target.value || null)}>
                <option value="">Not set</option><option>Female</option><option>Male</option><option>Other</option>
              </select>
            </Field>
            <Field label="Civil status">
              <select className={inputClass} value={draft.civil_status ?? ""} onChange={(event) => setValue("civil_status", event.target.value || null)}>
                <option value="">Not set</option><option>Single</option><option>Married</option><option>Widowed</option><option>Separated</option>
              </select>
            </Field>
            <Field label="Highest educational attainment">
              <select className={inputClass} value={draft.highest_educational_attainment ?? ""} onChange={(event) => setValue("highest_educational_attainment", event.target.value || null)}>
                <option value="">Not set</option>
                {educationalAttainments.map((attainment) => <option key={attainment} value={attainment}>{attainment}</option>)}
              </select>
            </Field>
          </Section>

          {canViewSensitive ? <Section title="Government numbers" description="Government-issued identifiers synchronize with a linked employee record; the system never invents these values.">
            <GovernmentIdFields disabled={!canEditSensitive} value={governmentIdValue} errors={errors} onChange={(identifiers) => setDraft((current) => ({ ...current, ...identifiers }))} />
          </Section> : null}</> : null}

          {tab === "contact" ? <Section title="Contact" description="Current contact and residential information.">
            <Field label="Mobile number"><input className={inputClass} inputMode="tel" maxLength={CHARACTER_LIMITS.phone} value={draft.mobile_number ?? ""} onChange={(event) => setValue("mobile_number", sanitizePhoneNumber(event.target.value) || null)} /></Field>
            <Field label="Email" error={errors.email}><input type="email" className={inputClass} value={draft.email ?? ""} onChange={(event) => setValue("email", event.target.value || null)} /></Field>
            <AddressFields value={addressValue} onChange={(address) => setDraft((current) => ({ ...current, ...address }))} />
            <div className="sm:col-span-2"><Field label="Emergency contact"><input className={inputClass} value={draft.emergency_contact ?? ""} onChange={(event) => setValue("emergency_contact", event.target.value || null)} /></Field></div>
          </Section> : null}

          {tab === "membership" ? <><Section title="Intended placement" description="Set the branch and client before BOD approval so the application is visible to the correct operational scope.">
            <Field label="Office / branch" error={errors.proposed_branch_id}><select className={inputClass} value={draft.proposed_branch_id ?? ""} onChange={(event) => { const branchId = event.target.value || null; setDraft((current) => ({ ...current, proposed_branch_id: branchId, proposed_client_id: null })); setErrors((current) => ({ ...current, proposed_branch_id: "", proposed_client_id: "" })); }}><option value="">Select office or branch</option>{branches.filter((branch) => branch.isActive).map((branch) => <option key={branch.id} value={branch.id}>{branch.type === "head_office" ? branch.label : `Branch: ${branch.label}`}</option>)}</select></Field>
            <Field label="Branch client" error={errors.proposed_client_id}><select className={inputClass} disabled={!draft.proposed_branch_id || !availableClients.length} value={draft.proposed_client_id ?? ""} onChange={(event) => setValue("proposed_client_id", event.target.value || null)}><option value="">Direct office / branch employee</option>{availableClients.map((client) => <option key={client.id} value={client.id}>{client.label}</option>)}</select></Field>
          </Section>
          <Section title="Membership" description="Cooperative registration and board acceptance details.">
            <Field label="Membership date"><input type="date" className={inputClass} value={draft.membership_date ?? ""} onChange={(event) => setValue("membership_date", event.target.value || null)} /></Field>
            <Field label="BOD approval"><input className={`${inputClass} bg-paper`} readOnly value={draft.bod_approval_status === "approved" ? "Approved" : "Pending approval"} /></Field>
            {draft.bod_approval_status === "approved" ? <Field label="Date & BOD resolution #"><input className={`${inputClass} bg-paper font-mono`} readOnly value={`${draft.acceptance_date ?? "Date not set"} / ${draft.acceptance_resolution_number ?? "Number not set"}`} /></Field> : null}
            <Field label="Membership type"><select className={inputClass} value={draft.membership_type_id ?? ""} onChange={(event) => setValue("membership_type_id", event.target.value || null)}>{memberTypes.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></Field>
            <Field label="Membership status"><select className={inputClass} value={draft.membership_status_id ?? ""} onChange={(event) => { const status = event.target.value || null; setValue("membership_status_id", status); if (!status || !terminalMemberStatuses.has(status)) { setValue("termination_date", null); setValue("termination_reason", null); } }}>{memberStatuses.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></Field>
            {membershipEnded ? (
              <>
                <Field label="Resignation / termination date" error={errors.termination_date}><input type="date" className={inputClass} value={draft.termination_date ?? ""} onChange={(event) => setValue("termination_date", event.target.value || null)} /></Field>
                <Field label="Reason"><input className={inputClass} value={draft.termination_reason ?? ""} onChange={(event) => setValue("termination_reason", event.target.value || null)} /></Field>
              </>
            ) : null}
            <Field label="Member category"><input className={inputClass} value={draft.member_category ?? ""} onChange={(event) => setValue("member_category", event.target.value || null)} placeholder="Community, Manpower" /></Field>
            <Field label="Religion / social affiliation"><select className={inputClass} value={draft.religion_affiliation_id ?? ""} onChange={(event) => setValue("religion_affiliation_id", event.target.value || null)}><option value="">Not set</option>{religionAffiliations.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></Field>
          </Section></> : null}

          {tab === "background" ? <><Section title="Background" description="Optional details from the cooperative registration record; financial ledger entries are excluded.">
            <Field label="Occupation / income source"><input className={inputClass} value={draft.occupation_income_source ?? ""} onChange={(event) => setValue("occupation_income_source", event.target.value || null)} /></Field>
            <Field label="Annual income"><input type="number" min="0" step="0.01" className={inputClass} value={draft.annual_income} onChange={(event) => setValue("annual_income", event.target.value)} /></Field>
            <div className="sm:col-span-2"><Field label="Notes"><textarea className={`${inputClass} min-h-24 resize-y`} value={draft.notes ?? ""} onChange={(event) => setValue("notes", event.target.value || null)} /></Field></div>
          </Section>
          {aliasEditor ? <Section title="Payroll aliases" description="Manage the client-specific names used to match payroll imports.">{aliasEditor}</Section> : null}</> : null}

          {tab === "beneficiaries" ? <Section title="Beneficiaries" description="Maintain up to three active dependents. Inactive records remain available with their reason.">
            {errors.beneficiaries ? <p className="sm:col-span-2 text-xs text-red-700">{errors.beneficiaries}</p> : null}
            <BeneficiaryEditor value={draft.beneficiaries} onChange={(value) => setValue("beneficiaries", value)} />
          </Section> : null}

          <footer className="sticky bottom-0 flex justify-end gap-3 border-t border-line bg-paper/95 px-6 py-4 backdrop-blur sm:px-8">
            <button type="button" className="focus-ring inline-flex items-center gap-2 rounded-md border border-line bg-white px-4 py-2.5 text-sm font-semibold text-ink hover:bg-paper" onClick={onCancel}><X className="h-4 w-4" /> Cancel</button>
            <button type="submit" disabled={saving} className="primary-button">
              <Save className="h-4 w-4" /> {saving ? "Saving..." : "Save member"}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
