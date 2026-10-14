import { useCallback, useState, type ReactNode } from "react";
import { Copy, Plus, Save, Trash2, X } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { SearchableSelect } from "../../components/ui/SearchableSelect";
import { useUnsavedChanges } from "../../components/forms/unsavedChanges";
import { useWorkspaceDialog } from "../../components/layout/WorkspaceNavigation";
import { useOrganization } from "../../services/organization/useOrganization";
import { createRepositories } from "../../services/repositories/repositoryFactory";
import type { PayrollRepository } from "../../services/repositories/PayrollRepository";
import type { PayrollData, PayrollInput, PayrollKind, PayrollRecord } from "../../types/payroll";
import { useAccess } from "../../services/access/useAccess";
import { placementOptions } from "../../services/access/placementOptions";
import type { TermsFieldGroup } from "../../services/payroll/employeeTermsBatch";
import { validatePayrollInput, salaryAmount } from "../../services/payroll/payrollSetup";
import { formatPesos } from "../../services/payments/paymentMath";
import { PayrollLookup } from "./PayrollLookup";
import { payrollLabels } from "./payrollLabels";
import { DutyScheduleFields } from "./DutyScheduleFields";

const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
function initialData(kind: PayrollKind, source?: PayrollRecord): PayrollData {
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  return { label: "", reason: "", branch_id: "", client_id: null, region: "", province: "", city: "", category: "", wage_series: null, series: "", source_url: "https://nwpc.dole.gov.ph/", order_reference: "", reviewed: false, minimum_daily_centavos: 0,
    employee_id: null, employee_label: "", worksite_id: "", worksite_label: "", department_id: null, position_id: null, effective_from: date, effective_to: null,
    pay_basis: "daily", monthly_mode: "direct", rate_centavos: 0, monthly_factor: null, frequency: "semi_monthly", payroll_group: "", shift_start: "08:00", shift_end: "17:00", break_minutes: 60, rest_days: [0], allowances: [],
    ...(source ? structuredClone(source.data) : {}), ...(source ? { reason: "", effective_from: date, effective_to: null, source_terms_id: source.kind === "client_terms" || source.kind === "employee_terms" || source.kind === "override" ? source.id : null } : {}),
    deduction_type: "cooperative", deduction_mode: "follow_default", deduction_centavos: 5000, opening_balance_centavos: null, deduction_reference: "",
    ...(kind === "client_terms" ? { employee_id: null, employee_label: "" } : {}), ...(kind === "override" ? { effective_to: date } : {}), ...(kind === "wage" ? { reviewed: false } : {}), ...(source && (kind === "deduction" || kind === "cooperative_policy") ? { deduction_type: source.data.deduction_type, deduction_mode: source.data.deduction_mode, deduction_centavos: source.data.deduction_centavos, opening_balance_centavos: source.data.opening_balance_centavos, deduction_reference: source.data.deduction_reference } : {}) };
}
function Field({ label, children, wide = false }: { label: string; children: ReactNode; wide?: boolean }) { return <label className={`field-label min-w-0 ${wide ? "sm:col-span-2" : ""}`}>{label}{children}</label>; }

export function PayrollRecordForm({ kind, source, repository, onClose, onSaved, initialValues, saveInput, extraFields, title, employeeLocked = false, activeGroups, externalDirty = false, onDraftChange, saveLabel = "Save version" }: { kind: PayrollKind; source?: PayrollRecord; repository: PayrollRepository; onClose: () => void; onSaved: () => void; initialValues?: Partial<PayrollData>; saveInput?: (input: PayrollInput) => Promise<unknown>; extraFields?: ReactNode; title?: string; employeeLocked?: boolean; activeGroups?: TermsFieldGroup[]; externalDirty?: boolean; onDraftChange?: () => void; saveLabel?: string }) {
  const baseline = () => ({ ...initialData(kind, source), ...initialValues });
  const [data, setData] = useState(baseline);
  const [error, setError] = useState("");
  const directory = useOrganization();
  const { profile } = useAccess();
  const scoped = placementOptions(profile, directory.branches, directory.clients);
  const mutation = useMutation({ mutationFn: () => saveInput ? saveInput({ kind, data }) : repository.save({ kind, data }), onSuccess: (result) => { if (result !== false) onSaved(); } });
  const { confirmDiscard } = useUnsavedChanges(externalDirty || JSON.stringify(data) !== JSON.stringify(baseline()), mutation.isPending);
  const close = () => { if (!mutation.isPending) confirmDiscard(onClose); };
  useWorkspaceDialog(title || `New ${payrollLabels[kind]}`, close);
  function set<K extends keyof PayrollData>(key: K, value: PayrollData[K]) { onDraftChange?.(); setData((d) => ({ ...d, [key]: value })); }
  const loadEmployees = useCallback(async (search: string) => (await createRepositories().employees.listPage({ search, limit: 20 })).items.map((e) => ({ id: e.id, label: `${e.employee_number} - ${e.last_name}, ${e.first_name}` })), []);
  const [placement, setPlacement] = useState({ branch: initialValues?.branch_id || source?.data.branch_id || "", client: initialValues?.client_id || source?.data.client_id || "" });
  const loadWorksites = useCallback(async (search: string) => (await repository.list({ kind: "worksite", search, branchId: placement.branch || undefined, clientId: placement.branch ? placement.client || null : undefined, limit: 20 })).items.map((r) => ({ id: r.id, label: r.data.label })), [repository, placement]);
  const [defaultsError, setDefaultsError] = useState("");
  async function copyDefaults() {
    try {
      setDefaultsError("");
      const candidates = (await repository.list({ kind: "client_terms", worksiteId: data.worksite_id, asOf: data.effective_from, limit: 100 })).items.filter((r) => (!r.data.department_id || r.data.department_id === data.department_id) && (!r.data.position_id || r.data.position_id === data.position_id));
      candidates.sort((a, b) => Number(Boolean(b.data.position_id)) - Number(Boolean(a.data.position_id)) || Number(Boolean(b.data.department_id)) - Number(Boolean(a.data.department_id)) || b.data.effective_from!.localeCompare(a.data.effective_from!));
      const record = candidates[0];
      if (!record || record.data.effective_to && record.data.effective_to < data.effective_from!) throw new Error("No matching client defaults apply to this worksite, duty, and date.");
      onDraftChange?.(); setData((d) => ({ ...structuredClone(record.data), label: d.label, reason: d.reason, employee_id: d.employee_id, employee_label: d.employee_label, effective_from: d.effective_from, effective_to: d.effective_to, department_id: d.department_id, position_id: d.position_id, source_terms_id: record.id }));
    } catch (reason) { setDefaultsError((reason as Error).message); }
  }
  const control = "compact-control mt-1 w-full";
  const text = (key: keyof PayrollData, required = false, type = "text") => {
    const update = (value: string) => { set(key, value as never); if (key === "effective_from" && kind === "override") set("effective_to", value); };
    return <input className={control} type={type} required={required} maxLength={key === "reason" ? 1000 : 200} value={String(data[key] ?? "")} onInput={(e) => { if (type === "date" || type === "time") update(e.currentTarget.value); }} onChange={(e) => update(e.target.value)} />;
  };
  const money = (key: "rate_centavos" | "minimum_daily_centavos" | "deduction_centavos" | "opening_balance_centavos") => <input className={control} type="number" min="0.01" step="0.01" required value={data[key] ? data[key]! / 100 : ""} onChange={(e) => set(key, Math.round(Number(e.target.value) * 100))} />;
  const terms = ["client_terms", "employee_terms", "override"].includes(kind);
  const visible = (group: TermsFieldGroup) => !activeGroups || activeGroups.includes(group);
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/45 p-3"><section role="dialog" aria-modal="true" aria-label={title || `New ${payrollLabels[kind]}`} className="flex max-h-[92dvh] w-full max-w-3xl flex-col overflow-hidden rounded-md bg-white shadow-xl"><header className="flex items-center justify-between border-b border-line px-4 py-3"><h2 className="text-sm font-semibold">{title || `${source ? "New version" : "New record"} / ${payrollLabels[kind]}`}</h2><button type="button" title="Close" aria-label="Close payroll form" className="icon-button" disabled={mutation.isPending} onClick={close}><X className="h-4 w-4" /></button></header>
    <form className="flex min-h-0 flex-col" onSubmit={(e) => { e.preventDefault(); try { if (!saveInput) validatePayrollInput({ kind, data }); setError(""); mutation.mutate(); } catch (reason) { setError((reason as Error).message); } }}><div className="min-h-0 overflow-y-auto"><fieldset disabled={mutation.isPending} className="grid min-w-0 gap-3 p-4 sm:grid-cols-2">
      {extraFields ? <div className="min-w-0 sm:col-span-2">{extraFields}</div> : null}
      {!employeeLocked ? <Field label="Record name" wide>{text("label", true)}</Field> : null}
      {kind === "worksite" ? <>
        <Field label="Branch"><SearchableSelect className={control} required value={data.branch_id || ""} onChange={(e) => { set("branch_id", e.target.value); set("client_id", null); }}><option value="">Select branch</option>{scoped.branches.filter((b) => b.isActive).map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}</SearchableSelect></Field>
        <Field label="Client"><SearchableSelect className={control} value={data.client_id || ""} onChange={(e) => set("client_id", e.target.value || null)}><option value="">Agency / direct employees</option>{scoped.clients.filter((c) => c.isActive && c.branchId === data.branch_id).map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</SearchableSelect></Field>
        <Field label="Region">{text("region", true)}</Field><Field label="Province">{text("province", true)}</Field><Field label="City / municipality">{text("city", true)}</Field><Field label="Wage category / coverage">{text("category", true)}</Field><Field label="Wage series code" wide>{text("wage_series")}</Field>
      </> : <><Field label={kind === "override" ? "Work date" : "Effective from"}>{text("effective_from", true, "date")}</Field>{kind !== "override" ? <Field label="Effective until (optional)">{text("effective_to", false, "date")}</Field> : null}</>}
      {kind === "wage" ? <><Field label="Wage series code">{text("series", true)}</Field><Field label="Region">{text("region", true)}</Field><Field label="Wage category / coverage">{text("category", true)}</Field><Field label="Wage order / tranche">{text("order_reference", true)}</Field><Field label="Daily minimum (PHP)">{money("minimum_daily_centavos")}</Field><Field label="Official source URL">{text("source_url", true, "url")}</Field><label className="filter-toggle sm:col-span-2"><input type="checkbox" checked={Boolean(data.reviewed)} onChange={(e) => set("reviewed", e.target.checked)} />Reviewed against the applicable wage order and coverage</label></> : null}
      {kind === "cooperative_policy" ? <Field label="Default cooperative deduction per cutoff (PHP)">{money("deduction_centavos")}</Field> : null}
      {kind === "deduction" ? <>
        {!employeeLocked ? <PayrollLookup label="Employee" value={data.employee_id || ""} selectedLabel={data.employee_label} load={loadEmployees} required onChange={(id, label) => { set("employee_id", id); set("employee_label", label); }} /> : null}
        <Field label="Deduction type"><SearchableSelect className={control} value={data.deduction_type} onChange={(e) => { set("deduction_type", e.target.value as PayrollData["deduction_type"]); if (e.target.value !== "cooperative") set("deduction_mode", "fixed"); }}><option value="cooperative">Cooperative contribution</option><option value="loan">Loan installment</option><option value="advance">Salary advance</option></SearchableSelect></Field>
        <Field label="Amount policy"><SearchableSelect className={control} value={data.deduction_mode} onChange={(e) => set("deduction_mode", e.target.value as PayrollData["deduction_mode"])}>{data.deduction_type === "cooperative" ? <option value="follow_default">Follow cooperative default</option> : null}<option value="fixed">Employee-specific amount</option></SearchableSelect></Field>
        {data.deduction_mode === "fixed" ? <Field label="Deduction per cutoff (PHP)">{money("deduction_centavos")}</Field> : null}
        {data.deduction_type !== "cooperative" ? <><Field label="Opening balance (PHP)">{money("opening_balance_centavos")}</Field><Field label="Loan / advance reference">{text("deduction_reference", true)}</Field></> : null}
      </> : null}
      {terms ? <>
        {kind !== "client_terms" && !employeeLocked ? <PayrollLookup label="Employee" value={data.employee_id || ""} selectedLabel={data.employee_label} load={loadEmployees} required onChange={(id, label) => { set("employee_id", id); set("employee_label", label); }} /> : null}
        {visible("worksite") ? <><Field label="Branch"><SearchableSelect className={control} required={kind === "client_terms"} value={placement.branch} onChange={(e) => { setPlacement({ branch: e.target.value, client: "" }); set("worksite_id", ""); set("worksite_label", ""); }}><option value="">Select branch</option>{scoped.branches.filter((b) => b.isActive).map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}</SearchableSelect></Field>
        <Field label="Client"><SearchableSelect className={control} disabled={!placement.branch} value={placement.client} onChange={(e) => { setPlacement((p) => ({ ...p, client: e.target.value })); set("worksite_id", ""); set("worksite_label", ""); }}><option value="">Agency / direct employees</option>{scoped.clients.filter((c) => c.isActive && c.branchId === placement.branch).map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</SearchableSelect></Field>
        <PayrollLookup label="Worksite" scopeKey={`${placement.branch}:${placement.client}`} disabled={kind === "client_terms" && !placement.branch} value={data.worksite_id || ""} selectedLabel={data.worksite_label} load={loadWorksites} required onChange={(id, label) => { set("worksite_id", id); set("worksite_label", label); set("branch_id", placement.branch); set("client_id", placement.client || null); }} /></> : null}
        {visible("duty") ? <><Field label="Department"><SearchableSelect className={control} value={data.department_id || ""} onChange={(e) => { set("department_id", e.target.value || null); set("position_id", null); }}><option value="">No department restriction</option>{directory.departments.filter((d) => d.isActive).map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}</SearchableSelect></Field>
        <Field label="Position"><SearchableSelect className={control} value={data.position_id || ""} onChange={(e) => set("position_id", e.target.value || null)}><option value="">No position restriction</option>{directory.positions.filter((p) => p.isActive && (!data.department_id || p.departmentId === data.department_id)).map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</SearchableSelect></Field>
        </> : null}
        {kind !== "client_terms" && !activeGroups ? <div className="sm:col-span-2"><button type="button" disabled={!data.worksite_id || mutation.isPending} className="secondary-button" onClick={() => void copyDefaults()}><Copy className="h-3.5 w-3.5" />Copy applicable client defaults</button>{defaultsError ? <p role="alert" className="mt-1 text-xs text-red-700">{defaultsError}</p> : null}</div> : null}
        {visible("basis") ? <Field label="Pay basis"><SearchableSelect className={control} value={data.pay_basis} onChange={(e) => set("pay_basis", e.target.value as PayrollData["pay_basis"])}><option value="daily">Daily</option><option value="monthly">Monthly</option></SearchableSelect></Field> : null}
        {visible("basis") && data.pay_basis === "monthly" ? <Field label="Monthly salary method"><SearchableSelect className={control} value={data.monthly_mode} onChange={(e) => set("monthly_mode", e.target.value as PayrollData["monthly_mode"])}><option value="direct">Direct monthly salary</option><option value="daily_factor">Daily reference rate × salary factor</option></SearchableSelect></Field> : null}
        {visible("rate") ? <Field label={activeGroups && !visible("basis") ? "New rate / salary (PHP)" : data.pay_basis === "monthly" && data.monthly_mode === "direct" ? "Monthly salary (PHP)" : "Daily reference rate (PHP)"}>{money("rate_centavos")}</Field> : null}
        {visible("basis") && data.pay_basis === "monthly" && data.monthly_mode === "daily_factor" ? <Field label="Monthly salary factor"><input className={control} type="number" min="0.01" max="366" step="0.01" required value={data.monthly_factor ?? ""} onChange={(e) => set("monthly_factor", Number(e.target.value))} /></Field> : null}
        {visible("group") ? <><Field label="Payroll frequency"><SearchableSelect className={control} value={data.frequency} onChange={(e) => set("frequency", e.target.value as PayrollData["frequency"])}><option value="weekly">Weekly</option><option value="semi_monthly">Semi-monthly</option><option value="monthly">Monthly</option></SearchableSelect></Field><Field label="Payroll / cutoff group">{text("payroll_group", true)}</Field></> : null}
        {visible("schedule") ? <DutyScheduleFields data={data} onChange={(changes) => { onDraftChange?.(); setData((d) => ({ ...d, ...changes })); }} /> : null}
        {visible("rest") ? <fieldset className="min-w-0"><legend className="field-label">Rest days</legend><div className="mt-2 flex flex-wrap gap-2">{weekdays.map((day, index) => <label key={day} className="flex items-center gap-1 text-xs"><input type="checkbox" checked={data.rest_days?.includes(index)} onChange={(e) => set("rest_days", e.target.checked ? [...data.rest_days!, index].sort() : data.rest_days!.filter((d) => d !== index))} />{day}</label>)}</div></fieldset> : null}
        {visible("allowances") ? <fieldset className="sm:col-span-2"><legend className="mb-2 text-xs font-semibold">Allowances</legend>{data.allowances?.map((a, i) => <div key={i} className="mb-2 grid grid-cols-2 gap-2 sm:grid-cols-[1fr_100px_130px_140px_32px]">
          <input className="compact-control w-full" aria-label={`Allowance ${i + 1} name`} placeholder="Allowance name" required value={a.name} onChange={(e) => set("allowances", data.allowances!.map((item, index) => index === i ? { ...item, name: e.target.value } : item))} />
          <input className="compact-control w-full" aria-label={`Allowance ${i + 1} amount`} type="number" min="0.01" step="0.01" required value={a.amount_centavos ? a.amount_centavos / 100 : ""} onChange={(e) => set("allowances", data.allowances!.map((item, index) => index === i ? { ...item, amount_centavos: Math.round(Number(e.target.value) * 100) } : item))} />
          <SearchableSelect className="compact-control w-full" aria-label={`Allowance ${i + 1} basis`} value={a.basis} onChange={(e) => set("allowances", data.allowances!.map((item, index) => index === i ? { ...item, basis: e.target.value as typeof a.basis } : item))}><option value="worked_day">Worked day</option><option value="cutoff">Per cutoff</option><option value="month">Per month</option></SearchableSelect>
          <SearchableSelect className="compact-control w-full" aria-label={`Allowance ${i + 1} tax treatment`} value={a.tax_treatment} onChange={(e) => set("allowances", data.allowances!.map((item, index) => index === i ? { ...item, tax_treatment: e.target.value as typeof a.tax_treatment } : item))}><option value="unreviewed">Needs tax review</option><option value="taxable">Taxable</option><option value="non_taxable">Non-taxable</option></SearchableSelect>
          <button type="button" className="icon-button" title="Remove allowance" aria-label={`Remove allowance ${i + 1}`} onClick={() => set("allowances", data.allowances!.filter((_, index) => index !== i))}><Trash2 className="h-3.5 w-3.5" /></button></div>)}<button type="button" disabled={data.allowances!.length >= 30} className="secondary-button" onClick={() => set("allowances", [...data.allowances!, { name: "", amount_centavos: 0, basis: "worked_day", tax_treatment: "unreviewed" }])}><Plus className="h-3.5 w-3.5" />Allowance</button></fieldset> : null}
        {!activeGroups && data.rate_centavos && (data.pay_basis !== "monthly" || data.monthly_mode !== "daily_factor" || Number(data.monthly_factor) > 0) ? <p className="text-xs font-semibold text-moss sm:col-span-2">{data.pay_basis === "monthly" ? "Monthly salary" : "Daily rate"}: {formatPesos(salaryAmount(data))}</p> : null}
      </> : null}
      <Field label="Change reason" wide><textarea className={control} rows={2} required maxLength={1000} value={data.reason} onChange={(e) => set("reason", e.target.value)} /></Field>
      {error || mutation.isError ? <p role="alert" className="text-xs text-red-700 sm:col-span-2">{error || mutation.error?.message}</p> : null}
    </fieldset></div><footer className="flex justify-end gap-2 border-t border-line px-4 py-3"><button type="button" className="secondary-button" disabled={mutation.isPending} onClick={close}>Cancel</button><button className="primary-button" disabled={mutation.isPending}><Save className="h-4 w-4" />{mutation.isPending ? "Processing..." : saveLabel}</button></footer></form></section></div>;
}
