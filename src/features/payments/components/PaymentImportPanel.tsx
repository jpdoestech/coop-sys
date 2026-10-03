import { useMemo, useState } from "react";
import { AlertTriangle, Building2, CalendarRange, FileCheck2, FileSpreadsheet, Upload } from "lucide-react";
import type { Employee } from "../../../types/employee";
import type { MemberAlias, PaymentImportMatch } from "../../../types/payment";
import type { OrganizationBranch, OrganizationClient } from "../../../types/organization";
import { matchPaymentRows, normalizeIdentityName } from "../../../services/imports/identityMatching";
import { paymentRowsFromSpreadsheet, readSpreadsheet } from "../../../services/imports/excelWorkbook";
import type { AliasInput, PaymentBatchInput, PaymentLineInput } from "../../../services/repositories/PaymentRepository";
import { EMPLOYMENT_STATUS } from "../../../services/lookups/statuses";
import { detailedPeriod } from "../paymentFilters";
import { PaymentImportValidationDialog } from "./PaymentImportValidationDialog";

const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const monthFromDate = (value: string) => value ? value.slice(5, 7).replace(/^0/, "") : String(new Date().getMonth() + 1);
type Props = { employees: Employee[]; aliases: MemberAlias[]; branches: OrganizationBranch[]; clients: OrganizationClient[]; userId: string; saving: boolean; onSaveAlias: (input: AliasInput) => Promise<MemberAlias>; onPost: (batch: PaymentBatchInput, lines: PaymentLineInput[]) => void };

export function PaymentImportPanel({ employees, aliases, branches, clients, userId, saving, onSaveAlias, onPost }: Props) {
  const [branchId, setBranchId] = useState(""); const [clientId, setClientId] = useState("");
  const [periodMode, setPeriodMode] = useState<"cutoff" | "date">("cutoff");
  const [from, setFrom] = useState(""); const [to, setTo] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10)); const [month, setMonth] = useState(String(new Date().getMonth() + 1)); const [fileName, setFileName] = useState("");
  const [matches, setMatches] = useState<PaymentImportMatch[]>([]); const [overrides, setOverrides] = useState<Record<number, string>>({}); const [error, setError] = useState("");
  const [overrideSearch, setOverrideSearch] = useState<Record<number, string>>({}); const [includeInactive, setIncludeInactive] = useState(false); const [previewOpen, setPreviewOpen] = useState(false);
  const allScoped = useMemo(() => employees.filter((employee) => employee.member_id && [employee.active_assignment, ...employee.assignment_history].some((assignment) => assignment?.branch_id === branchId && assignment?.client_id === clientId)), [employees, branchId, clientId]);
  const scoped = useMemo(() => allScoped.filter((employee) => includeInactive || employee.employment_status_id === EMPLOYMENT_STATUS.active), [allScoped, includeInactive]);
  const resolvedCount = matches.filter((row) => scoped.find((employee) => employee.id === (row.employeeId ?? overrides[row.rowNumber]))?.member_id).length;
  const branch = branches.find((item) => item.id === branchId); const client = clients.find((item) => item.id === clientId);
  const periodLabel = periodMode === "cutoff" && from && to ? detailedPeriod(from, to, date) : detailedPeriod(null, null, date);

  function resetImport() { setMatches([]); setOverrides({}); setOverrideSearch({}); setFileName(""); setPreviewOpen(false); setError(""); }

  async function load(file: File | undefined) {
    if (!file) return;
    try {
      if (!branchId || !clientId) throw new Error("Select the branch and client before choosing a payroll file.");
      if (periodMode === "cutoff" && (!from || !to || from > to)) throw new Error("Enter a valid cut-off date range before choosing a payroll file.");
      const rows = paymentRowsFromSpreadsheet(await readSpreadsheet(file));
      const activeMatches = matchPaymentRows(rows, scoped, aliases, clientId);
      const allMatches = includeInactive ? activeMatches : matchPaymentRows(rows, allScoped, aliases, clientId);
      setMatches(activeMatches.map((match, index) => !match.employeeId && allMatches[index]?.employeeId ? { ...match, suggestedEmployeeId: null, error: "Employee is inactive. Load inactive employees to review and link this record." } : match));
      setOverrides({}); setOverrideSearch({}); setFileName(file.name); setError(""); setPreviewOpen(true);
    } catch (reason) { setMatches([]); setPreviewOpen(false); setError(reason instanceof Error ? reason.message : "Excel file could not be read."); }
  }

  function toggleInactive() {
    const next = !includeInactive; setIncludeInactive(next);
    if (matches.length) {
      const rows = matches.map(({ rowNumber, id, name, amountCentavos, remarks }) => ({ rowNumber, id, name, amountCentavos, remarks }));
      setMatches(matchPaymentRows(rows, next ? allScoped : allScoped.filter((employee) => employee.employment_status_id === EMPLOYMENT_STATUS.active), aliases, clientId));
      setOverrides({}); setOverrideSearch({});
    }
  }

  async function confirmAlias(row: PaymentImportMatch) {
    const employeeId = overrides[row.rowNumber]; if (!employeeId) return;
    try {
      await onSaveAlias({ employee_id: employeeId, client_id: clientId, alias: row.name.trim(), normalized_alias: normalizeIdentityName(row.name) });
      const employee = scoped.find((item) => item.id === employeeId);
      setMatches((current) => current.map((item) => item.rowNumber === row.rowNumber ? { ...item, employeeId, memberId: employee?.member_id ?? null, matchedBy: "alias", confidence: 1, error: employee?.member_id ? null : "Employee is not linked to a member." } : item));
      setError("");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Alias could not be saved."); }
  }

  function post() {
    try {
      if (!matches.length || resolvedCount !== matches.length) throw new Error("Resolve every unmatched row before posting this payroll deduction batch.");
      if (periodMode === "cutoff" && (!from || !to || from > to)) throw new Error("Enter a valid cut-off date range.");
      const lines: PaymentLineInput[] = matches.map((row) => {
        const employeeId = row.employeeId ?? overrides[row.rowNumber]; const employee = scoped.find((item) => item.id === employeeId);
        if (!employee?.member_id) throw new Error(`Row ${row.rowNumber} is not linked to a member.`);
        return { employee_id: employee.id, member_id: employee.member_id, amount_centavos: row.amountCentavos, remarks: null };
      });
      const batch: PaymentBatchInput = { branch_id: branchId, client_id: clientId, method: "payroll_deduction", cutoff_from: periodMode === "cutoff" ? from : null, cutoff_to: periodMode === "cutoff" ? to : null, payroll_month: Number(month), payment_date: date, source_file_name: fileName, remarks: null, created_by: userId };
      setError(""); onPost(batch, lines);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Batch could not be prepared."); }
  }

  return <div className="space-y-3 p-3 sm:p-4">
    <div className="grid gap-4 lg:grid-cols-[minmax(18rem,0.85fr)_minmax(30rem,1.35fr)] lg:gap-0">
      <fieldset className="min-w-0 lg:pr-4"><legend className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase text-ink/50"><Building2 className="h-3.5 w-3.5 text-moss" /> Import scope</legend><div className="grid gap-2 sm:grid-cols-2">
        <label className="field-label">Branch<select className="compact-control mt-1 w-full" value={branchId} onChange={(event) => { setBranchId(event.target.value); setClientId(""); resetImport(); }}><option value="">Select branch</option>{branches.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
        <label className="field-label">Client<select className="compact-control mt-1 w-full disabled:cursor-not-allowed disabled:bg-paper disabled:text-ink/35" disabled={!branchId} value={clientId} onChange={(event) => { setClientId(event.target.value); resetImport(); }}><option value="">Select client</option>{clients.filter((item) => item.branchId === branchId).map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
      </div></fieldset>
      <fieldset className="min-w-0 border-t border-line pt-3 lg:border-l lg:border-t-0 lg:pl-4 lg:pt-0"><legend className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase text-ink/50 lg:px-1"><CalendarRange className="h-3.5 w-3.5 text-moss" /> Payroll period</legend><div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        <label className="field-label">Import basis<select className="compact-control mt-1 w-full" value={periodMode} onChange={(event) => { const nextMode = event.target.value as "cutoff" | "date"; setPeriodMode(nextMode); setMonth(monthFromDate(nextMode === "cutoff" && from ? from : date)); resetImport(); }}><option value="cutoff">Cut-off</option><option value="date">Date only</option></select></label>
        <label className="field-label">Payment date<input className="compact-control mt-1 w-full" type="date" value={date} onChange={(event) => { const value = event.target.value; setDate(value); if (periodMode === "date" || !from) setMonth(monthFromDate(value)); }} /></label>
        {periodMode === "cutoff" ? <><label className="field-label">Cut-off from<input className="compact-control mt-1 w-full" type="date" value={from} onChange={(event) => { const value = event.target.value; setFrom(value); setMonth(monthFromDate(value || date)); }} /></label><label className="field-label">Cut-off to<input className="compact-control mt-1 w-full" type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label></> : null}
        <label className="field-label">Payroll month<select className="compact-control mt-1 w-full" value={month} onChange={(event) => setMonth(event.target.value)}>{months.map((item, index) => <option key={item} value={index + 1}>{item}</option>)}</select></label>
      </div></fieldset>
    </div>

    <label className="group flex min-h-14 cursor-pointer items-center justify-between gap-3 rounded-md border border-dashed border-line bg-paper px-3 py-2.5 text-sm transition hover:border-moss hover:bg-[#f1f7f3]"><span className="flex min-w-0 items-center gap-2.5"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-line bg-white text-moss"><FileSpreadsheet className="h-4 w-4" /></span><span className="min-w-0"><span className="block truncate text-xs font-semibold text-ink">{fileName || "Choose payroll deduction workbook"}</span><span className="block truncate text-[11px] text-ink/45">Required: ID or NAME, plus AMOUNT. Imported remarks are not posted.</span></span></span><Upload className="h-4 w-4 shrink-0 text-ink/45 transition group-hover:text-moss" /><input className="sr-only" type="file" accept=".xlsx,.xlsm" onChange={(event) => void load(event.target.files?.[0])} /></label>
    {error && !previewOpen ? <p className="flex items-center gap-2 text-xs text-red-700"><AlertTriangle className="h-4 w-4" />{error}</p> : null}
    {matches.length ? <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-line bg-[#fafcfb] px-3 py-2"><div className="flex items-center gap-2"><FileCheck2 className="h-4 w-4 text-moss" /><p className="text-xs"><strong>{matches.length} rows loaded</strong><span className="ml-2 text-ink/50">{resolvedCount} ready · {matches.length - resolvedCount} need attention</span></p></div><button type="button" className="secondary-button" onClick={() => setPreviewOpen(true)}><FileCheck2 className="h-4 w-4" /> Review validation</button></div> : null}

    {previewOpen && matches.length ? <PaymentImportValidationDialog matches={matches} employees={scoped} overrides={overrides} overrideSearch={overrideSearch} fileName={fileName} scopeLabel={`${branch?.label ?? "Branch"} / ${client?.label ?? "Client"}`} periodLabel={periodLabel} includeInactive={includeInactive} saving={saving} error={error} onClose={() => setPreviewOpen(false)} onToggleInactive={toggleInactive} onAmountChange={(rowNumber, amountCentavos) => setMatches((current) => current.map((item) => item.rowNumber === rowNumber ? { ...item, amountCentavos } : item))} onSearchChange={(rowNumber, value, employeeId) => { setOverrideSearch((current) => ({ ...current, [rowNumber]: value })); setOverrides((current) => ({ ...current, [rowNumber]: employeeId })); }} onSaveAlias={confirmAlias} onPost={post} /> : null}
  </div>;
}
