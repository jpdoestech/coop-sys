import { AlertTriangle, CheckCircle2, FileSpreadsheet, Tags, Upload } from "lucide-react";
import { useMemo, useState } from "react";
import type { Employee } from "../../../types/employee";
import type { MemberAlias } from "../../../types/payment";
import type { OrganizationBranch, OrganizationClient } from "../../../types/organization";
import type { AliasInput } from "../../../services/repositories/PaymentRepository";
import { aliasRowsFromSpreadsheet, readSpreadsheet, type AliasImportRow } from "../../../services/imports/excelWorkbook";
import { employeeFullName, matchPaymentRows, normalizeIdentityName } from "../../../services/imports/identityMatching";

type ResolvedAlias = AliasImportRow & { employeeId: string | null; search: string };
type Props = { employees: Employee[]; aliases: MemberAlias[]; branches: OrganizationBranch[]; clients: OrganizationClient[]; saving: boolean; onSaveAlias: (input: AliasInput) => Promise<MemberAlias> };

export function AliasImportPanel({ employees, aliases, branches, clients, saving, onSaveAlias }: Props) {
  const [branchId, setBranchId] = useState(""); const [clientId, setClientId] = useState(""); const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<ResolvedAlias[]>([]); const [error, setError] = useState(""); const [done, setDone] = useState(0);
  const scoped = useMemo(() => employees.filter((employee) => [employee.active_assignment, ...employee.assignment_history].some((assignment) => assignment?.branch_id === branchId && assignment?.client_id === clientId)), [employees, branchId, clientId]);
  const optionValue = (employee: Employee) => `${employee.employee_number} - ${employeeFullName(employee)}`;

  async function load(file: File | undefined) {
    if (!file) return;
    try {
      if (!branchId || !clientId) throw new Error("Select the branch and client before choosing an alias workbook.");
      const imported = aliasRowsFromSpreadsheet(await readSpreadsheet(file));
      const matched = matchPaymentRows(imported.map((row) => ({ ...row, amountCentavos: 1, remarks: "" })), scoped, [], clientId);
      setRows(imported.map((row, index) => ({ ...row, employeeId: matched[index].employeeId, search: matched[index].employeeId ? optionValue(scoped.find((employee) => employee.id === matched[index].employeeId)!) : "" })));
      setFileName(file.name); setDone(0); setError("");
    } catch (reason) { setRows([]); setError(reason instanceof Error ? reason.message : "Alias workbook could not be read."); }
  }

  async function saveAll() {
    try {
      if (!rows.length || rows.some((row) => !row.employeeId)) throw new Error("Link every alias row to an employee before importing.");
      const normalized = new Set<string>();
      for (const row of rows) { const key = normalizeIdentityName(row.alias); if (normalized.has(key)) throw new Error(`Duplicate alias in workbook: ${row.alias}.`); normalized.add(key); const duplicate = aliases.find((item) => !item.deleted_at && item.client_id === clientId && item.normalized_alias === key && item.employee_id !== row.employeeId); if (duplicate) throw new Error(`Alias ${row.alias} already belongs to another employee for this client.`); }
      let saved = 0; for (const row of rows) { await onSaveAlias({ employee_id: row.employeeId!, client_id: clientId, alias: row.alias.trim(), normalized_alias: normalizeIdentityName(row.alias) }); saved += 1; setDone(saved); }
      setError("");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Aliases could not be imported."); }
  }

  return <div className="space-y-4 p-4 sm:p-5">
    <div className="flex items-start gap-3"><span className="flex h-8 w-8 items-center justify-center rounded bg-[#e4efe9] text-moss"><Tags className="h-4 w-4" /></span><div><h3 className="text-sm font-semibold">Import payroll aliases</h3><p className="text-xs text-ink/50">Aliases are unique within a client and can be linked by employee ID or name.</p></div></div>
    <div className="grid gap-3 sm:grid-cols-2"><label className="field-label">Branch<select className="control mt-1 w-full" value={branchId} onChange={(event) => { setBranchId(event.target.value); setClientId(""); setRows([]); }}><option value="">Select branch</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.label}</option>)}</select></label><label className="field-label">Client<select className="control mt-1 w-full" value={clientId} onChange={(event) => { setClientId(event.target.value); setRows([]); }}><option value="">Select client</option>{clients.filter((client) => client.branchId === branchId).map((client) => <option key={client.id} value={client.id}>{client.label}</option>)}</select></label></div>
    <label className="flex cursor-pointer items-center justify-between rounded-md border border-dashed border-line bg-paper px-4 py-3 text-sm hover:border-moss"><span className="flex items-center gap-2"><FileSpreadsheet className="h-5 w-5 text-moss" /><span><span className="block font-medium">{fileName || "Choose alias workbook"}</span><span className="text-xs text-ink/45">Headers: ID or NAME, and ALIAS.</span></span></span><Upload className="h-4 w-4" /><input className="sr-only" type="file" accept=".xlsx,.xlsm" onChange={(event) => void load(event.target.files?.[0])} /></label>
    {error ? <p className="flex items-center gap-2 text-xs text-red-700"><AlertTriangle className="h-4 w-4" />{error}</p> : null}
    {rows.length ? <><datalist id="alias-import-employees">{scoped.map((employee) => <option key={employee.id} value={optionValue(employee)} />)}</datalist><div className="max-h-[48vh] overflow-auto rounded-md border border-line"><table className="w-full min-w-[760px] text-left text-xs"><thead className="sticky top-0 bg-[#f8faf8] text-[10px] uppercase text-ink/45"><tr><th className="px-3 py-2">Row</th><th className="px-3 py-2">Imported identity</th><th className="px-3 py-2">Alias</th><th className="px-3 py-2">Employee link</th></tr></thead><tbody className="divide-y divide-line">{rows.map((row) => <tr key={row.rowNumber}><td className="px-3 py-2 font-mono">{row.rowNumber}</td><td className="px-3 py-2"><span className="block font-medium">{row.name || "No name"}</span><span className="text-ink/45">{row.id || "No ID"}</span></td><td className="px-3 py-2"><input className="compact-control w-full" value={row.alias} onChange={(event) => setRows((current) => current.map((item) => item.rowNumber === row.rowNumber ? { ...item, alias: event.target.value } : item))} /></td><td className="px-3 py-2"><div className="relative"><input className="compact-control w-full pr-8" list="alias-import-employees" value={row.search} placeholder="Type employee ID or name" onChange={(event) => { const employee = scoped.find((item) => optionValue(item) === event.target.value || item.employee_number === event.target.value); setRows((current) => current.map((item) => item.rowNumber === row.rowNumber ? { ...item, search: event.target.value, employeeId: employee?.id ?? null } : item)); }} />{row.employeeId ? <CheckCircle2 className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-600" /> : null}</div></td></tr>)}</tbody></table></div><div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-ink/45">{done ? `${done} of ${rows.length} aliases saved` : `${rows.filter((row) => row.employeeId).length} of ${rows.length} rows linked`}</p><button type="button" className="primary-button" disabled={saving || rows.some((row) => !row.employeeId)} onClick={() => void saveAll()}><Upload className="h-4 w-4" />Import {rows.length} aliases</button></div></> : null}
  </div>;
}
