import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { History, Link2, Save, UserPlus, X } from "lucide-react";
import { AddressFields, type AddressValue } from "../../../components/forms/AddressFields";
import { GovernmentIdFields, type GovernmentIdValue } from "../../../components/forms/GovernmentIdFields";
import { employeeProfileFromMember } from "../../../services/identity/personProfileSync";
import { terminalEmploymentStatuses } from "../../../services/lookups/statuses";
import { religionAffiliations } from "../../../services/lookups/religionAffiliations";
import { employeeInputSchema } from "../../../services/validation/employeeSchema";
import type { Employee, EmployeeInput } from "../../../types/employee";
import type { Member } from "../../../types/member";
import { AssignmentEditor } from "./AssignmentEditor";
import { BeneficiaryEditor } from "../../../components/forms/BeneficiaryEditor";
import {
  employmentStatuses,
  employmentTypes,
  HEAD_OFFICE_ID,
} from "../data/employeeOptions";
import type { EmployeeSubmission } from "../types/employeeWorkflow";
import { CHARACTER_LIMITS, sanitizePhoneNumber } from "../../../utils/inputSanitizers";
import { useOrganization } from "../../../services/organization/useOrganization";
import { MemberSearchField } from "./MemberSearchField";
import { createUuid } from "../../../utils/createUuid";

type MembershipMode = "none" | "existing" | "create";

type Props = {
  employee: Employee | null;
  suggestedNumber: string;
  members: Member[];
  formerEmployees: Employee[];
  saving: boolean;
  saveError?: string;
  aliasEditor?: ReactNode;
  onCancel: () => void;
  onSubmit: (submission: EmployeeSubmission) => void;
};

const inputClass =
  "control mt-1.5 w-full disabled:bg-line/20 disabled:text-ink/55";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block text-xs font-semibold text-ink/75">{label}{children}</label>;
}

function Section({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <section className="border-t border-line px-6 py-5 sm:px-8">
      <div className="mb-4 sm:flex sm:justify-between sm:gap-6">
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="mt-1 max-w-md text-xs leading-5 text-ink/55 sm:mt-0 sm:text-right">{description}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function newAssignment() {
  return {
    id: createUuid(),
    branch_id: HEAD_OFFICE_ID,
    client_id: null,
    assignment_code: null,
    start_date: new Date().toISOString().slice(0, 10),
    end_date: null,
    work_location: "Head Office",
    transfer_reason: null,
    notes: null,
  };
}

function emptyInput(suggestedNumber = ""): EmployeeInput {
  return {
    employee_number: suggestedNumber,
    member_id: null,
    religion_affiliation_id: null,
    sss_number: null,
    pagibig_number: null,
    philhealth_number: null,
    tax_identification_number: null,
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
    employment_status_id: employmentStatuses[0].id,
    employment_type_id: employmentTypes[0].id,
    date_hired: new Date().toISOString().slice(0, 10),
    date_regularized: null,
    date_separated: null,
    position_id: null,
    department_id: null,
    supervisor_id: null,
    work_location: null,
    notes: null,
    beneficiaries: [],
    active_assignment: newAssignment(),
  };
}

function toInput(employee: Employee | null, suggestedNumber = ""): EmployeeInput {
  if (!employee) return emptyInput(suggestedNumber);
  const omitted = new Set(["id", "created_at", "updated_at", "deleted_at", "sync_status", "assignment_history"]);
  return Object.fromEntries(
    Object.entries(employee).filter(([key]) => !omitted.has(key)),
  ) as unknown as EmployeeInput;
}

export function EmployeeForm({ employee, suggestedNumber, members, formerEmployees, saving, saveError, aliasEditor, onCancel, onSubmit }: Props) {
  const { departments, positions } = useOrganization();
  const [draft, setDraft] = useState<EmployeeInput>(() => toInput(employee, suggestedNumber));
  const [error, setError] = useState("");
  const [membershipMode, setMembershipMode] = useState<MembershipMode>(employee?.member_id ? "existing" : "none");
  const [rehireSourceId, setRehireSourceId] = useState("");
  const [transferring, setTransferring] = useState(false);
  const linkedMember = useMemo(
    () => members.find((member) => member.id === draft.member_id) ?? null,
    [members, draft.member_id],
  );
  const availablePositions = positions.filter(
    (position) => position.isActive && (!draft.department_id || position.departmentId === draft.department_id),
  );
  const employmentEnded = Boolean(
    draft.employment_status_id && terminalEmploymentStatuses.has(draft.employment_status_id),
  );

  useEffect(() => {
    setDraft(toInput(employee, suggestedNumber));
    setMembershipMode(employee?.member_id ? "existing" : "none");
    setRehireSourceId("");
    setTransferring(false);
    setError("");
  }, [employee, suggestedNumber]);

  function setValue<K extends keyof EmployeeInput>(field: K, value: EmployeeInput[K]) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function selectMember(memberId: string) {
    const member = members.find((item) => item.id === memberId);
    if (!member) {
      setValue("member_id", null);
      return;
    }
    setDraft((current) => ({ ...current, ...employeeProfileFromMember(member) }));
  }

  function changeMembershipMode(mode: MembershipMode) {
    setMembershipMode(mode);
    setError("");
    if (mode !== "existing") setValue("member_id", null);
  }

  function selectFormerEmployee(sourceId: string) {
    setRehireSourceId(sourceId);
    const source = formerEmployees.find((item) => item.id === sourceId);
    if (!source) {
      setDraft(emptyInput(suggestedNumber));
      setMembershipMode("none");
      return;
    }

    const copied = toInput(source);
    const refreshed: EmployeeInput = {
      ...copied,
      employee_number: suggestedNumber,
      employment_status_id: employmentStatuses[0].id,
      date_hired: new Date().toISOString().slice(0, 10),
      date_regularized: null,
      date_separated: null,
      position_id: null,
      department_id: null,
      supervisor_id: null,
      work_location: null,
      beneficiaries: copied.beneficiaries.map((beneficiary) => ({
        ...beneficiary,
        id: createUuid(),
      })),
      active_assignment: newAssignment(),
    };
    const sourceMember = members.find((member) => member.id === source.member_id);
    setDraft(sourceMember ? { ...refreshed, ...employeeProfileFromMember(sourceMember) } : refreshed);
    setMembershipMode(source.member_id ? "existing" : "none");
    setTransferring(false);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (membershipMode === "existing" && !draft.member_id) {
      setError("Select the existing member ID to link.");
      return;
    }
    if (transferring && !draft.active_assignment?.transfer_reason?.trim()) {
      setError("Enter a reason for the employee transfer.");
      return;
    }
    if (
      transferring &&
      employee?.active_assignment &&
      draft.active_assignment &&
      draft.active_assignment.start_date < employee.active_assignment.start_date
    ) {
      setError("Transfer date cannot be earlier than the current assignment start date.");
      return;
    }
    const submissionDraft =
      draft.employment_status_id &&
      terminalEmploymentStatuses.has(draft.employment_status_id) &&
      draft.date_separated &&
      draft.active_assignment
        ? {
            ...draft,
            active_assignment: {
              ...draft.active_assignment,
              end_date: draft.date_separated,
            },
          }
        : draft;
    const result = employeeInputSchema.safeParse(submissionDraft);
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? "Please review the employee record.");
      return;
    }
    const membership = membershipMode === "existing"
      ? { mode: "existing" as const, memberId: draft.member_id! }
      : membershipMode === "create"
        ? { mode: "create" as const, membershipNumber: draft.employee_number }
        : { mode: "none" as const };
    onSubmit({ input: result.data as EmployeeInput, membership });
  }

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

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-ink/35" role="presentation">
      <div className="h-full w-full max-w-4xl overflow-y-auto bg-white shadow-panel" role="dialog" aria-modal="true" aria-labelledby="employee-form-title">
        <form onSubmit={submit}>
          <header className="sticky top-0 z-10 flex items-start justify-between border-b border-line bg-paper/95 px-6 py-5 backdrop-blur sm:px-8">
            <div><p className="text-xs font-semibold uppercase text-clay">Employee record</p><h2 id="employee-form-title" className="mt-1 font-display text-2xl font-semibold">{employee ? "Edit employee" : "New employee"}</h2></div>
            <button type="button" className="focus-ring rounded p-2 text-ink/65 hover:bg-white" onClick={onCancel} aria-label="Close employee form"><X className="h-5 w-5" /></button>
          </header>
          {error || saveError ? <div className="mx-6 mt-5 border-l-4 border-red-600 bg-red-50 px-4 py-3 text-sm text-red-800 sm:mx-8">{error || saveError}</div> : null}

          {!employee && formerEmployees.length ? (
            <Section title="Re-employment" description="Start from a former employee's identity while re-entering employment details for the new engagement.">
              <div className="sm:col-span-2">
                <Field label="Previous employee record">
                  <select className={inputClass} value={rehireSourceId} onChange={(event) => selectFormerEmployee(event.target.value)}>
                    <option value="">Start with a blank employee record</option>
                    {formerEmployees.map((item) => <option key={item.id} value={item.id}>{item.employee_number} - {item.last_name}, {item.first_name}</option>)}
                  </select>
                </Field>
                {rehireSourceId ? <p className="mt-2 flex items-center gap-1.5 text-xs text-moss"><History className="h-3.5 w-3.5" /> Identity and beneficiary details copied. Hire date, placement, and assignment must be entered again.</p> : null}
              </div>
            </Section>
          ) : null}

          <Section title="Identity and membership" description="Choose whether to reuse an existing member ID or register a separate new membership.">
            <fieldset className="sm:col-span-2">
              <legend className="text-xs font-semibold text-ink/75">Membership handling</legend>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                {([
                  ["none", "Not a member"],
                  ["existing", "Use existing member ID"],
                  ...(!employee ? [["create", "Register as new member"]] : []),
                ] as Array<[MembershipMode, string]>).map(([mode, label]) => (
                  <label key={mode} className={`flex cursor-pointer items-center gap-2 border px-3 py-2.5 text-sm ${membershipMode === mode ? "border-moss bg-moss/5 text-moss" : "border-line bg-white text-ink/70"}`}>
                    <input type="radio" name="membership-mode" value={mode} checked={membershipMode === mode} onChange={() => changeMembershipMode(mode)} />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>
            {membershipMode === "existing" ? (
              <div className="sm:col-span-2">
                <Field label="Existing cooperative member">
                  <MemberSearchField members={members} value={draft.member_id ?? ""} onChange={selectMember} />
                </Field>
                {linkedMember ? <p className="mt-2 flex items-center gap-1.5 text-xs text-moss"><Link2 className="h-3.5 w-3.5" /> Identity and contact details are sourced from {linkedMember.membership_number}.</p> : null}
              </div>
            ) : null}
            {membershipMode === "create" ? (
              <div className="sm:col-span-2">
                <p className="sm:col-span-2 rounded-md bg-emerald-50 px-3 py-2 text-xs text-emerald-800">The membership record will use person number <span className="font-mono font-semibold">{draft.employee_number}</span>.</p>
                <p className="mt-2 flex items-center gap-1.5 text-xs text-moss"><UserPlus className="h-3.5 w-3.5" /> A new Associate membership will copy shared identity, address, and government numbers only.</p>
              </div>
            ) : null}
            <Field label="Person number"><input className={`${inputClass} bg-paper font-mono`} value={draft.employee_number} readOnly aria-readonly="true" /></Field>
            <Field label="Religion / social affiliation"><select className={inputClass} value={draft.religion_affiliation_id ?? ""} onChange={(event) => setValue("religion_affiliation_id", event.target.value || null)}><option value="">Not set</option>{religionAffiliations.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></Field>
            <Field label="First name"><input disabled={Boolean(linkedMember)} className={inputClass} value={draft.first_name} onChange={(event) => setValue("first_name", event.target.value)} /></Field>
            <Field label="Last name"><input disabled={Boolean(linkedMember)} className={inputClass} value={draft.last_name} onChange={(event) => setValue("last_name", event.target.value)} /></Field>
            <Field label="Middle name"><input disabled={Boolean(linkedMember)} className={inputClass} value={draft.middle_name ?? ""} onChange={(event) => setValue("middle_name", event.target.value || null)} /></Field>
            <Field label="Date of birth"><input type="date" disabled={Boolean(linkedMember)} className={inputClass} value={draft.date_of_birth ?? ""} onChange={(event) => setValue("date_of_birth", event.target.value || null)} /></Field>
            <Field label="Mobile number"><input disabled={Boolean(linkedMember)} className={inputClass} inputMode="tel" maxLength={CHARACTER_LIMITS.phone} value={draft.mobile_number ?? ""} onChange={(event) => setValue("mobile_number", sanitizePhoneNumber(event.target.value) || null)} /></Field>
            <Field label="Email"><input type="email" disabled={Boolean(linkedMember)} className={inputClass} value={draft.email ?? ""} onChange={(event) => setValue("email", event.target.value || null)} /></Field>
          </Section>

          {aliasEditor ? <Section title="Payroll aliases" description="Alternate payroll names are client-specific and can also be maintained during imports.">{aliasEditor}</Section> : null}

          <Section title="Government numbers" description="Government-issued identifiers synchronize in both directions with the linked membership record.">
            <GovernmentIdFields value={governmentIdValue} onChange={(identifiers) => setDraft((current) => ({ ...current, ...identifiers }))} />
          </Section>

          <Section title="Home address" description="Type to search, then choose a valid Philippine region, province, city, and barangay.">
            <AddressFields value={addressValue} disabled={Boolean(linkedMember)} onChange={(value) => setDraft((current) => ({ ...current, ...value }))} />
          </Section>

          <Section title="Employment" description="Current status and organizational placement.">
            <Field label="Employment status"><select className={inputClass} value={draft.employment_status_id ?? ""} onChange={(event) => { const status = event.target.value || null; setValue("employment_status_id", status); if (!status || !terminalEmploymentStatuses.has(status)) setValue("date_separated", null); }}>{employmentStatuses.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></Field>
            <Field label="Employment type"><select className={inputClass} value={draft.employment_type_id ?? ""} onChange={(event) => setValue("employment_type_id", event.target.value || null)}>{employmentTypes.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></Field>
            <Field label="Date hired"><input type="date" className={inputClass} value={draft.date_hired ?? ""} onChange={(event) => setValue("date_hired", event.target.value || null)} /></Field>
            <Field label="Date regularized"><input type="date" className={inputClass} value={draft.date_regularized ?? ""} onChange={(event) => setValue("date_regularized", event.target.value || null)} /></Field>
            {employmentEnded ? <Field label="Resignation / termination date"><input type="date" className={inputClass} value={draft.date_separated ?? ""} onChange={(event) => setValue("date_separated", event.target.value || null)} /></Field> : null}
            <Field label="Department"><select className={inputClass} value={draft.department_id ?? ""} onChange={(event) => { setValue("department_id", event.target.value || null); setValue("position_id", null); }}><option value="">Not set</option>{departments.filter((item) => item.isActive).map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></Field>
            <Field label="Position"><select className={inputClass} value={draft.position_id ?? ""} onChange={(event) => setValue("position_id", event.target.value || null)}><option value="">Not set</option>{availablePositions.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></Field>
          </Section>

          <Section title="Organizational placement" description="Head Office employees are direct; branch clients appear only under their assigned branch. Transfers retain prior placements.">
            <AssignmentEditor
              value={draft.active_assignment}
              history={employee?.assignment_history ?? []}
              existingActive={employee?.active_assignment ?? null}
              transferring={transferring}
              onChange={(assignment) => {
                setValue("active_assignment", assignment);
                setValue("work_location", assignment?.work_location ?? null);
              }}
              onBeginTransfer={() => {
                setTransferring(true);
                setValue("active_assignment", newAssignment());
              }}
              onCancelTransfer={() => {
                setTransferring(false);
                setValue("active_assignment", employee?.active_assignment ?? null);
              }}
            />
          </Section>

          <Section title="Beneficiaries" description="The displayed dependent count is calculated from active beneficiary records.">
            <BeneficiaryEditor value={draft.beneficiaries} onChange={(value) => setValue("beneficiaries", value)} />
          </Section>

          <Section title="Notes" description="Optional internal context for authorized staff."><div className="sm:col-span-2"><textarea className={`${inputClass} min-h-24 resize-y`} value={draft.notes ?? ""} onChange={(event) => setValue("notes", event.target.value || null)} /></div></Section>
          <footer className="sticky bottom-0 flex justify-end gap-3 border-t border-line bg-white/95 px-6 py-4 backdrop-blur sm:px-8"><button type="button" onClick={onCancel} className="focus-ring inline-flex items-center gap-2 rounded-md border border-line bg-white px-4 py-2.5 text-sm font-semibold"><X className="h-4 w-4" /> Cancel</button><button type="submit" disabled={saving} className="primary-button"><Save className="h-4 w-4" />{saving ? "Saving..." : "Save employee"}</button></footer>
        </form>
      </div>
    </div>
  );
}
