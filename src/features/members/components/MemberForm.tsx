import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Save, X } from "lucide-react";
import { memberInputSchema } from "../../../services/validation/memberSchema";
import { religionAffiliations } from "../../../services/lookups/religionAffiliations";
import type { Member, MemberInput } from "../../../types/member";
import { memberStatuses, memberTypes } from "../data/memberOptions";

type Draft = Omit<MemberInput, "annual_income" | "number_of_dependents"> & {
  annual_income: string;
  number_of_dependents: string;
};

type MemberFormProps = {
  member: Member | null;
  saving: boolean;
  onCancel: () => void;
  onSubmit: (input: MemberInput) => void;
};

const inputClass =
  "focus-ring mt-1.5 w-full rounded border border-line bg-white px-3 py-2.5 text-sm text-ink placeholder:text-ink/35";

function emptyDraft(): Draft {
  return {
    membership_number: "",
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
    membership_status_id: memberStatuses[0].id,
    membership_type_id: memberTypes[0].id,
    member_category: null,
    religion_affiliation_id: null,
    tax_identification_number: null,
    acceptance_resolution_number: null,
    highest_educational_attainment: null,
    occupation_income_source: null,
    annual_income: "",
    number_of_dependents: "",
    beneficiary_name: null,
    religion_affiliation: null,
    termination_date: null,
    termination_reason: null,
    emergency_contact: null,
    notes: null,
    profile_photo_ref: null
  };
}

function toDraft(member: Member | null): Draft {
  if (!member) return emptyDraft();
  const recordFields = new Set(["id", "created_at", "updated_at", "deleted_at", "sync_status"]);
  const input = Object.fromEntries(
    Object.entries(member).filter(([field]) => !recordFields.has(field))
  ) as MemberInput;
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

export function MemberForm({ member, saving, onCancel, onSubmit }: MemberFormProps) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(member));
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    setDraft(toDraft(member));
    setErrors({});
  }, [member]);

  function setValue<K extends keyof Draft>(field: K, value: Draft[K]) {
    setDraft((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: "" }));
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = memberInputSchema.safeParse({
      ...draft,
      annual_income: draft.annual_income === "" ? null : Number(draft.annual_income),
      number_of_dependents:
        draft.number_of_dependents === "" ? null : Number(draft.number_of_dependents)
    });

    if (!result.success) {
      const fieldErrors = result.error.flatten().fieldErrors;
      setErrors(
        Object.fromEntries(
          Object.entries(fieldErrors).map(([field, messages]) => [field, messages?.[0] ?? "Invalid value"])
        )
      );
      return;
    }

    onSubmit(result.data as MemberInput);
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-ink/35" role="presentation">
      <div className="h-full w-full max-w-3xl overflow-y-auto bg-paper shadow-panel" role="dialog" aria-modal="true" aria-labelledby="member-form-title">
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

          <Section title="Identity" description="Core details shared with an employee profile when this person has both roles.">
            <Field label="Membership number" error={errors.membership_number}>
              <input className={inputClass} value={draft.membership_number} onChange={(event) => setValue("membership_number", event.target.value)} placeholder="MEM-0001" />
            </Field>
            <Field label="TIN">
              <input className={inputClass} value={draft.tax_identification_number ?? ""} onChange={(event) => setValue("tax_identification_number", event.target.value || null)} placeholder="000-000-000-000" />
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
              <input className={inputClass} value={draft.highest_educational_attainment ?? ""} onChange={(event) => setValue("highest_educational_attainment", event.target.value || null)} />
            </Field>
          </Section>

          <Section title="Contact" description="Current contact and residential information.">
            <Field label="Mobile number"><input className={inputClass} value={draft.mobile_number ?? ""} onChange={(event) => setValue("mobile_number", event.target.value || null)} /></Field>
            <Field label="Email" error={errors.email}><input type="email" className={inputClass} value={draft.email ?? ""} onChange={(event) => setValue("email", event.target.value || null)} /></Field>
            <div className="sm:col-span-2"><Field label="Street address"><input className={inputClass} value={draft.address ?? ""} onChange={(event) => setValue("address", event.target.value || null)} /></Field></div>
            <Field label="Barangay"><input className={inputClass} value={draft.barangay ?? ""} onChange={(event) => setValue("barangay", event.target.value || null)} /></Field>
            <Field label="City / municipality"><input className={inputClass} value={draft.city_municipality ?? ""} onChange={(event) => setValue("city_municipality", event.target.value || null)} /></Field>
            <Field label="Province"><input className={inputClass} value={draft.province ?? ""} onChange={(event) => setValue("province", event.target.value || null)} /></Field>
            <Field label="Postal code"><input className={inputClass} value={draft.postal_code ?? ""} onChange={(event) => setValue("postal_code", event.target.value || null)} /></Field>
            <div className="sm:col-span-2"><Field label="Emergency contact"><input className={inputClass} value={draft.emergency_contact ?? ""} onChange={(event) => setValue("emergency_contact", event.target.value || null)} /></Field></div>
          </Section>

          <Section title="Membership" description="Cooperative registration and board acceptance details.">
            <Field label="Membership date"><input type="date" className={inputClass} value={draft.membership_date ?? ""} onChange={(event) => setValue("membership_date", event.target.value || null)} /></Field>
            <Field label="Acceptance resolution number"><input className={inputClass} value={draft.acceptance_resolution_number ?? ""} onChange={(event) => setValue("acceptance_resolution_number", event.target.value || null)} /></Field>
            <Field label="Membership type"><select className={inputClass} value={draft.membership_type_id ?? ""} onChange={(event) => setValue("membership_type_id", event.target.value || null)}>{memberTypes.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></Field>
            <Field label="Membership status"><select className={inputClass} value={draft.membership_status_id ?? ""} onChange={(event) => setValue("membership_status_id", event.target.value || null)}>{memberStatuses.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></Field>
            <Field label="Member category"><input className={inputClass} value={draft.member_category ?? ""} onChange={(event) => setValue("member_category", event.target.value || null)} placeholder="Community, Manpower" /></Field>
            <Field label="Religion / social affiliation"><select className={inputClass} value={draft.religion_affiliation_id ?? ""} onChange={(event) => setValue("religion_affiliation_id", event.target.value || null)}><option value="">Not set</option>{religionAffiliations.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></Field>
          </Section>

          <Section title="Background" description="Optional details from the cooperative registration record; financial ledger entries are excluded.">
            <Field label="Occupation / income source"><input className={inputClass} value={draft.occupation_income_source ?? ""} onChange={(event) => setValue("occupation_income_source", event.target.value || null)} /></Field>
            <Field label="Annual income"><input type="number" min="0" step="0.01" className={inputClass} value={draft.annual_income} onChange={(event) => setValue("annual_income", event.target.value)} /></Field>
            <div className="sm:col-span-2 border-l-4 border-moss bg-white px-4 py-3 text-xs leading-5 text-ink/65">Dependent totals are calculated from active beneficiary records on the linked employee profile. Up to three beneficiaries may be active at once.</div>
            <div className="sm:col-span-2"><Field label="Notes"><textarea className={`${inputClass} min-h-24 resize-y`} value={draft.notes ?? ""} onChange={(event) => setValue("notes", event.target.value || null)} /></Field></div>
          </Section>

          <footer className="sticky bottom-0 flex justify-end gap-3 border-t border-line bg-paper/95 px-6 py-4 backdrop-blur sm:px-8">
            <button type="button" className="focus-ring rounded border border-line bg-white px-4 py-2.5 text-sm font-semibold text-ink hover:bg-paper" onClick={onCancel}>Cancel</button>
            <button type="submit" disabled={saving} className="focus-ring inline-flex items-center gap-2 rounded bg-moss px-4 py-2.5 text-sm font-semibold text-white hover:bg-moss/90 disabled:cursor-wait disabled:opacity-60">
              <Save className="h-4 w-4" /> {saving ? "Saving..." : "Save member"}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
