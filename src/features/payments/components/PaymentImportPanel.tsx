import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, FileSpreadsheet, Link2, Upload, UserRoundSearch } from "lucide-react";
import type { Employee } from "../../../types/employee";
import type { MemberAlias, PaymentImportMatch } from "../../../types/payment";
import type { OrganizationBranch, OrganizationClient } from "../../../types/organization";
import { employeeFullName, matchPaymentRows, normalizeIdentityName } from "../../../services/imports/identityMatching";
import { paymentRowsFromSpreadsheet, readSpreadsheet } from "../../../services/imports/excelWorkbook";
import type { AliasInput, PaymentBatchInput, PaymentLineInput } from "../../../services/repositories/PaymentRepository";
import { EMPLOYMENT_STATUS } from "../../../services/lookups/statuses";

const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
type Props = { employees: Employee[]; aliases: MemberAlias[]; branches: OrganizationBranch[]; clients: OrganizationClient[]; userId: string; saving: boolean; onSaveAlias: (input: AliasInput) => Promise<MemberAlias>; onPost: (batch: PaymentBatchInput, lines: PaymentLineInput[]) => void };

export function PaymentImportPanel({ employees, aliases, branches, clients, userId, saving, onSaveAlias, onPost }: Props) {
  const [branchId, setBranchId] = useState(""); const [clientId, setClientId] = useState("");
  const [periodMode, setPeriodMode] = useState<"cutoff" | "date">("cutoff");
  const [from, setFrom] = useState(""); const [to, setTo] = useState(""); const [month, setMonth] = useState(String(new Date().getMonth() + 1));
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10)); const [fileName, setFileName] = useState("");
  const [matches, setMatches] = useState<PaymentImportMatch[]>([]); const [overrides, setOverrides] = useState<Record<number, string>>({}); const [error, setError] = useState("");
  const [overrideSearch, setOverrideSearch] = useState<Record<number, string>>({});
  const [includeInactive, setIncludeInactive] = useState(false);
  const allScoped = useMemo(() => employees.filter((employee) => employee.member_id && [employee.active_assignment, ...employee.assignment_history].some((assignment) => assignment?.branch_id === branchId && assignment?.client_id === clientId)), [employees, branchId, clientId]);
  const scoped = useMemo(() => allScoped.filter((employee) => includeInactive || employee.employment_status_id === EMPLOYMENT_STATUS.active), [allScoped, includeInactive]);
  const resolvedCount = matches.filter((row) => row.employeeId || overrides[row.rowNumber]).length;

  async function load(file: File | undefined) {
    if (!file) return;
    try {
      if (!branchId || !clientId) throw new Error("Select the branch and client before choosing a payroll file.");
      const rows = paymentRowsFromSpreadsheet(await readSpreadsheet(file));
      const activeMatches = matchPaymentRows(rows, scoped, aliases, clientId);
      const allMatches = includeInactive ? activeMatches : matchPaymentRows(rows, allScoped, aliases, clientId);
      setMatches(activeMatches.map((match, index) => !match.employeeId && allMatches[index]?.employeeId ? { ...match, suggestedEmployeeId: null, error: "Employee is inactive. Click Search inactive employees to load and link the record." } : match)); setOverrides({}); setOverrideSearch({}); setFileName(file.name); setError("");
    } catch (reason) { setMatches([]); setError(reason instanceof Error ? reason.message : "Excel file could not be read."); }
  }

  function toggleInactive() {
    const next = !includeInactive; setIncludeInactive(next);
    if (matches.length) { const rows = matches.map(({ rowNumber, id, name, amountCentavos, remarks }) => ({ rowNumber, id, name, amountCentavos, remarks })); setMatches(matchPaymentRows(rows, next ? allScoped : allScoped.filter((employee) => employee.employment_status_id === EMPLOYMENT_STATUS.active), aliases, clientId)); setOverrides({}); setOverrideSearch({}); }
  }

  async function confirmAlias(row: PaymentImportMatch) {
    const employeeId = overrides[row.rowNumber];
    if (!employeeId) return;
    try { await onSaveAlias({ employee_id: employeeId, client_id: clientId, alias: row.name.trim(), normalized_alias: normalizeIdentityName(row.name) }); setMatches((current) => current.map((item) => item.rowNumber === row.rowNumber ? { ...item, employeeId, memberId: scoped.find((employee) => employee.id === employeeId)?.member_id ?? null, matchedBy: "alias", confidence: 1, error: null } : item)); setError(""); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Alias could not be saved."); }
  }

  function post() {
    try {
      if (!matches.length || resolvedCount !== matches.length) throw new Error("Resolve every unmatched row before posting this payroll deduction batch.");
      if (periodMode === "cutoff" && (!from || !to || from > to)) throw new Error("Enter a valid cut-off date range.");
      const lines: PaymentLineInput[] = matches.map((row) => { const employeeId = row.employeeId ?? overrides[row.rowNumber]; const employee = scoped.find((item) => item.id === employeeId); if (!employee?.member_id) throw new Error(`Row ${row.rowNumber} is not linked to a member.`); return { employee_id: employee.id, member_id: employee.member_id, amount_centavos: row.amountCentavos, remarks: row.remarks || null }; });
      const batch: PaymentBatchInput = { branch_id: branchId, client_id: clientId, method: "payroll_deduction", cutoff_from: periodMode === "cutoff" ? from : null, cutoff_to: periodMode === "cutoff" ? to : null, payroll_month: periodMode === "cutoff" ? Number(month) : null, payment_date: date, source_file_name: fileName, remarks: null, created_by: userId };
      setError(""); onPost(batch, lines);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Batch could not be prepared."); }
  }

  return <div className="space-y-3 p-4">
    <div className="grid gap-3 lg:grid-cols-6">
      <label className="field-label lg:col-span-2">Branch<select className="control mt-1" value={branchId} onChange={(e) => { setBranchId(e.target.value); setClientId(""); setMatches([]); }}><option value="">Select branch</option>{branches.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
      <label className="field-label lg:col-span-2">Client<select className="control mt-1" value={clientId} onChange={(e) => { setClientId(e.target.value); setMatches([]); }}><option value="">Select client</option>{clients.filter((item) => item.branchId === branchId).map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
      <label className="field-label">Payment date<input className="control mt-1" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
      <label className="field-label">Import basis<select className="control mt-1" value={periodMode} onChange={(e) => setPeriodMode(e.target.value as "cutoff" | "date")}><option value="cutoff">Payroll cut-off</option><option value="date">Date only</option></select></label>
      {periodMode === "cutoff" ? <><label className="field-label lg:col-span-2">Cut-off from<input className="control mt-1" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label><label className="field-label lg:col-span-2">Cut-off to<input className="control mt-1" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label><label className="field-label lg:col-span-2">Payroll month<select className="control mt-1" value={month} onChange={(e) => setMonth(e.target.value)}>{months.map((item, index) => <option key={item} value={index + 1}>{item}</option>)}</select></label></> : null}
    </div>
    <label className="flex cursor-pointer items-center justify-between rounded-md border border-dashed border-line bg-paper px-4 py-3 text-sm hover:border-moss"><span className="flex items-center gap-2"><FileSpreadsheet className="h-5 w-5 text-moss" /><span><span className="block font-medium">{fileName || "Choose payroll deduction workbook"}</span><span className="text-xs text-ink/45">Required headers: ID, NAME, AMOUNT, REMARKS. ID may be blank.</span></span></span><Upload className="h-4 w-4" /><input className="sr-only" type="file" accept=".xlsx,.xlsm" onChange={(e) => void load(e.target.files?.[0])} /></label>
    {error ? <p className="flex items-center gap-2 text-xs text-red-700"><AlertTriangle className="h-4 w-4" />{error}</p> : null}
    {matches.length ? <><div className="flex justify-end"><button type="button" className="secondary-button" onClick={toggleInactive}><UserRoundSearch className="h-4 w-4" />{includeInactive ? "Use active employees only" : "Search inactive employees"}</button></div><div className="overflow-auto rounded-md border border-line"><datalist id="payment-employee-search">{scoped.map((item) => <option key={item.id} value={`${item.employee_number} - ${employeeFullName(item)}${item.employment_status_id === EMPLOYMENT_STATUS.active ? "" : " (inactive)"}`} />)}</datalist><table className="min-w-[1080px] w-full text-left text-xs"><thead className="sticky top-0 bg-ink text-white"><tr><th className="px-3 py-2">Row</th><th className="px-3 py-2">ID / name</th><th className="px-3 py-2">Amount</th><th className="px-3 py-2">Remarks</th><th className="px-3 py-2">Match result</th><th className="px-3 py-2">Resolution</th></tr></thead><tbody>{matches.map((row) => <tr key={row.rowNumber} className="border-b border-line"><td className="px-3 py-2">{row.rowNumber}</td><td className="px-3 py-2"><span className="block font-medium">{row.name}</span><span className="text-ink/45">{row.id || "No ID"}</span></td><td className="px-3 py-2"><input className="compact-control w-28 font-mono" type="number" min="0.01" step="0.01" defaultValue={(row.amountCentavos / 100).toFixed(2)} aria-label={`Amount for row ${row.rowNumber}`} onBlur={(event) => { const cents = Math.round(Number(event.target.value) * 100); if (cents > 0) setMatches((current) => current.map((item) => item.rowNumber === row.rowNumber ? { ...item, amountCentavos: cents } : item)); }} /></td><td className="px-3 py-2"><input className="compact-control w-full min-w-44" maxLength={200} value={row.remarks} placeholder="Optional" onChange={(event) => setMatches((current) => current.map((item) => item.rowNumber === row.rowNumber ? { ...item, remarks: event.target.value } : item))} /></td><td className="px-3 py-2">{row.employeeId ? <span className="inline-flex items-center gap-1 text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" />100% {row.matchedBy}</span> : <span className="text-amber-700">{row.error}</span>}</td><td className="px-3 py-2">{row.employeeId ? employeeFullName(scoped.find((item) => item.id === row.employeeId)!) : <div className="flex gap-2"><input className="compact-control min-w-64" list="payment-employee-search" placeholder="Type employee ID or name" value={overrideSearch[row.rowNumber] ?? ""} onChange={(event) => { const value = event.target.value; const employee = scoped.find((item) => value === `${item.employee_number} - ${employeeFullName(item)}${item.employment_status_id === EMPLOYMENT_STATUS.active ? "" : " (inactive)"}` || value === item.employee_number); setOverrideSearch((current) => ({ ...current, [row.rowNumber]: value })); setOverrides((current) => ({ ...current, [row.rowNumber]: employee?.id ?? "" })); }} /><button type="button" disabled={!overrides[row.rowNumber]} className="secondary-button" onClick={() => void confirmAlias({ ...row, suggestedEmployeeId: null })}><Link2 className="h-4 w-4" /> Save alias</button></div>}</td></tr>)}</tbody></table></div></> : null}
    {matches.length ? <div className="flex items-center justify-between"><p className="text-xs text-ink/50">{resolvedCount} of {matches.length} rows ready</p><button type="button" disabled={resolvedCount !== matches.length || saving} onClick={post} className="primary-button"><Upload className="h-4 w-4" />{saving ? "Posting..." : `Post ${matches.length} deductions`}</button></div> : null}
  </div>;
}
