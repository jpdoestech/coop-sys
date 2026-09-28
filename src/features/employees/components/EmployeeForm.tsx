import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Link2, Save, X } from "lucide-react";
import { AddressFields, type AddressValue } from "../../../components/forms/AddressFields";
import { employeeInputSchema } from "../../../services/validation/employeeSchema";
import { religionAffiliations } from "../../../services/lookups/religionAffiliations";
import type { Employee, EmployeeInput } from "../../../types/employee";
import type { Member } from "../../../types/member";
import { BeneficiaryEditor } from "./BeneficiaryEditor";
import { branches, clients, departments, employmentStatuses, employmentTypes, positions } from "../data/employeeOptions";

type Props = { employee: Employee | null; members: Member[]; saving: boolean; onCancel: () => void; onSubmit: (input: EmployeeInput) => void };
const inputClass = "focus-ring mt-1.5 w-full rounded border border-line bg-white px-3 py-2.5 text-sm text-ink disabled:bg-line/20 disabled:text-ink/55";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block text-xs font-semibold text-ink/75">{label}{children}</label>;
}
function Section({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return <section className="border-t border-line px-6 py-5 sm:px-8"><div className="mb-4 sm:flex sm:justify-between sm:gap-6"><h3 className="text-sm font-semibold">{title}</h3><p className="mt-1 max-w-md text-xs leading-5 text-ink/55 sm:mt-0 sm:text-right">{description}</p></div><div className="grid gap-4 sm:grid-cols-2">{children}</div></section>;
}

function emptyInput(): EmployeeInput {
  return {
    employee_number: "", member_id: null, religion_affiliation_id: null, first_name: "", middle_name: null, last_name: "", suffix: null,
    date_of_birth: null, sex: null, civil_status: null, mobile_number: null, email: null, address: null, barangay: null, city_municipality: null, province: null, postal_code: null,
    employment_status_id: employmentStatuses[0].id, employment_type_id: employmentTypes[0].id, date_hired: new Date().toISOString().slice(0, 10), date_regularized: null, date_separated: null,
    position_id: null, department_id: null, supervisor_id: null, work_location: null, notes: null, beneficiaries: [],
    active_assignment: { id: crypto.randomUUID(), branch_id: null, client_id: null, assignment_code: null, start_date: new Date().toISOString().slice(0, 10), end_date: null, work_location: null, notes: null }
  };
}

function toInput(employee: Employee | null): EmployeeInput {
  if (!employee) return emptyInput();
  const omitted = new Set(["id", "created_at", "updated_at", "deleted_at", "sync_status"]);
  return Object.fromEntries(
    Object.entries(employee).filter(([key]) => !omitted.has(key))
  ) as unknown as EmployeeInput;
}

export function EmployeeForm({ employee, members, saving, onCancel, onSubmit }: Props) {
  const [draft, setDraft] = useState<EmployeeInput>(() => toInput(employee));
  const [error, setError] = useState("");
  const linkedMember = useMemo(() => members.find((member) => member.id === draft.member_id) ?? null, [members, draft.member_id]);
  const availablePositions = positions.filter((position) => !draft.department_id || position.departmentId === draft.department_id);

  useEffect(() => { setDraft(toInput(employee)); setError(""); }, [employee]);
  function setValue<K extends keyof EmployeeInput>(field: K, value: EmployeeInput[K]) { setDraft((current) => ({ ...current, [field]: value })); }

  function selectMember(memberId: string) {
    const member = members.find((item) => item.id === memberId);
    if (!member) { setValue("member_id", null); return; }
    setDraft((current) => ({ ...current, member_id: member.id, first_name: member.first_name, middle_name: member.middle_name, last_name: member.last_name, suffix: member.suffix, date_of_birth: member.date_of_birth, sex: member.sex, civil_status: member.civil_status, mobile_number: member.mobile_number, email: member.email, address: member.address, barangay: member.barangay, city_municipality: member.city_municipality, province: member.province, postal_code: member.postal_code }));
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const result = employeeInputSchema.safeParse(draft);
    if (!result.success) { setError(result.error.issues[0]?.message ?? "Please review the employee record."); return; }
    onSubmit(result.data as EmployeeInput);
  }

  const addressValue: AddressValue = { address: draft.address, barangay: draft.barangay, city_municipality: draft.city_municipality, province: draft.province, postal_code: draft.postal_code };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-ink/35" role="presentation">
      <div className="h-full w-full max-w-4xl overflow-y-auto bg-paper shadow-panel" role="dialog" aria-modal="true" aria-labelledby="employee-form-title">
        <form onSubmit={submit}>
          <header className="sticky top-0 z-10 flex items-start justify-between border-b border-line bg-paper/95 px-6 py-5 backdrop-blur sm:px-8"><div><p className="text-xs font-semibold uppercase text-clay">Employee record</p><h2 id="employee-form-title" className="mt-1 font-display text-2xl font-semibold">{employee ? "Edit employee" : "New employee"}</h2></div><button type="button" className="focus-ring rounded p-2 text-ink/65 hover:bg-white" onClick={onCancel} aria-label="Close employee form"><X className="h-5 w-5" /></button></header>
          {error ? <div className="mx-6 mt-5 border-l-4 border-red-600 bg-red-50 px-4 py-3 text-sm text-red-800 sm:mx-8">{error}</div> : null}

          <Section title="Identity and membership" description="Link an existing member to keep shared personal details authoritative.">
            <div className="sm:col-span-2"><Field label="Linked cooperative member"><select className={inputClass} value={draft.member_id ?? ""} onChange={(event) => selectMember(event.target.value)}><option value="">Not a cooperative member</option>{members.map((member) => <option key={member.id} value={member.id}>{member.membership_number} - {member.last_name}, {member.first_name}</option>)}</select></Field>{linkedMember ? <p className="mt-2 flex items-center gap-1.5 text-xs text-moss"><Link2 className="h-3.5 w-3.5" /> Personal and contact details are sourced from {linkedMember.membership_number}.</p> : null}</div>
            <Field label="Employee number"><input className={inputClass} value={draft.employee_number} onChange={(event) => setValue("employee_number", event.target.value)} placeholder="EMP-0001" /></Field>
            <Field label="Religion / social affiliation"><select className={inputClass} value={draft.religion_affiliation_id ?? ""} onChange={(event) => setValue("religion_affiliation_id", event.target.value || null)}><option value="">Not set</option>{religionAffiliations.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></Field>
            <Field label="First name"><input disabled={Boolean(linkedMember)} className={inputClass} value={draft.first_name} onChange={(event) => setValue("first_name", event.target.value)} /></Field>
            <Field label="Last name"><input disabled={Boolean(linkedMember)} className={inputClass} value={draft.last_name} onChange={(event) => setValue("last_name", event.target.value)} /></Field>
            <Field label="Middle name"><input disabled={Boolean(linkedMember)} className={inputClass} value={draft.middle_name ?? ""} onChange={(event) => setValue("middle_name", event.target.value || null)} /></Field>
            <Field label="Date of birth"><input type="date" disabled={Boolean(linkedMember)} className={inputClass} value={draft.date_of_birth ?? ""} onChange={(event) => setValue("date_of_birth", event.target.value || null)} /></Field>
            <Field label="Mobile number"><input disabled={Boolean(linkedMember)} className={inputClass} value={draft.mobile_number ?? ""} onChange={(event) => setValue("mobile_number", event.target.value || null)} /></Field>
            <Field label="Email"><input type="email" disabled={Boolean(linkedMember)} className={inputClass} value={draft.email ?? ""} onChange={(event) => setValue("email", event.target.value || null)} /></Field>
          </Section>

          <Section title="Home address" description="Uses the Philippine region, province, city, and barangay reference dataset.">
            <AddressFields value={addressValue} disabled={Boolean(linkedMember)} onChange={(value) => setDraft((current) => ({ ...current, ...value }))} />
          </Section>

          <Section title="Employment" description="Current status and organizational placement.">
            <Field label="Employment status"><select className={inputClass} value={draft.employment_status_id ?? ""} onChange={(event) => setValue("employment_status_id", event.target.value || null)}>{employmentStatuses.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></Field>
            <Field label="Employment type"><select className={inputClass} value={draft.employment_type_id ?? ""} onChange={(event) => setValue("employment_type_id", event.target.value || null)}>{employmentTypes.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></Field>
            <Field label="Date hired"><input type="date" className={inputClass} value={draft.date_hired ?? ""} onChange={(event) => setValue("date_hired", event.target.value || null)} /></Field>
            <Field label="Date regularized"><input type="date" className={inputClass} value={draft.date_regularized ?? ""} onChange={(event) => setValue("date_regularized", event.target.value || null)} /></Field>
            <Field label="Department"><select className={inputClass} value={draft.department_id ?? ""} onChange={(event) => { setValue("department_id", event.target.value || null); setValue("position_id", null); }}><option value="">Not set</option>{departments.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></Field>
            <Field label="Position"><select className={inputClass} value={draft.position_id ?? ""} onChange={(event) => setValue("position_id", event.target.value || null)}><option value="">Not set</option>{availablePositions.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></Field>
          </Section>

          <Section title="Manpower assignment" description="Current branch and client deployment; completed assignments remain in history.">
            <Field label="Branch"><select className={inputClass} value={draft.active_assignment?.branch_id ?? ""} onChange={(event) => setValue("active_assignment", { ...(draft.active_assignment ?? emptyInput().active_assignment!), branch_id: event.target.value || null })}><option value="">Not set</option>{branches.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></Field>
            <Field label="Client"><select className={inputClass} value={draft.active_assignment?.client_id ?? ""} onChange={(event) => setValue("active_assignment", { ...(draft.active_assignment ?? emptyInput().active_assignment!), client_id: event.target.value || null })}><option value="">Not set</option>{clients.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></Field>
            <Field label="Assignment code"><input className={inputClass} value={draft.active_assignment?.assignment_code ?? ""} onChange={(event) => setValue("active_assignment", { ...(draft.active_assignment ?? emptyInput().active_assignment!), assignment_code: event.target.value || null })} /></Field>
            <Field label="Start date"><input type="date" className={inputClass} value={draft.active_assignment?.start_date ?? ""} onChange={(event) => setValue("active_assignment", { ...(draft.active_assignment ?? emptyInput().active_assignment!), start_date: event.target.value })} /></Field>
            <div className="sm:col-span-2"><Field label="Work location"><input className={inputClass} value={draft.active_assignment?.work_location ?? ""} onChange={(event) => { const value = event.target.value || null; setValue("work_location", value); setValue("active_assignment", { ...(draft.active_assignment ?? emptyInput().active_assignment!), work_location: value }); }} /></Field></div>
          </Section>

          <Section title="Beneficiaries" description="The displayed dependent count is calculated from active beneficiary records.">
            <BeneficiaryEditor value={draft.beneficiaries} onChange={(value) => setValue("beneficiaries", value)} />
          </Section>

          <Section title="Notes" description="Optional internal context for authorized staff."><div className="sm:col-span-2"><textarea className={`${inputClass} min-h-24 resize-y`} value={draft.notes ?? ""} onChange={(event) => setValue("notes", event.target.value || null)} /></div></Section>
          <footer className="sticky bottom-0 flex justify-end gap-3 border-t border-line bg-paper/95 px-6 py-4 backdrop-blur sm:px-8"><button type="button" onClick={onCancel} className="focus-ring rounded border border-line bg-white px-4 py-2.5 text-sm font-semibold">Cancel</button><button type="submit" disabled={saving} className="focus-ring inline-flex items-center gap-2 rounded bg-moss px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"><Save className="h-4 w-4" />{saving ? "Saving..." : "Save employee"}</button></footer>
        </form>
      </div>
    </div>
  );
}
