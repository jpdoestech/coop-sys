import { SearchableSelect } from "../ui/SearchableSelect";
import { useUnsavedChanges } from "./unsavedChanges";
import { useState } from "react";
import { AlertTriangle, ArrowRight, Building2, CheckCircle2, Download, FileSpreadsheet, Link2, Search, SlidersHorizontal, Upload, UserRoundSearch, X } from "lucide-react";
import type { OrganizationBranch, OrganizationClient } from "../../types/organization";
import { readSpreadsheet, type SpreadsheetRow } from "../../services/imports/excelWorkbook";
import { personRowsFromSpreadsheet, type ImportErrorType, type PersonImportLookups, type PersonImportOutcome, type PersonImportRow } from "../../services/imports/personImport";
import { departments, positions } from "../../features/employees/data/employeeOptions";
import { downloadPersonImportTemplate } from "../../services/imports/personImportTemplate";
import { usePlacementSelection } from "./usePlacementSelection";
import { PaginationControls } from "../ui/PaginationControls";
import { PersonImportRowEditor } from "./PersonImportRowEditor";
import { importErrorLabels } from "../../services/imports/personImportErrors";
import { withActivity } from "../../services/activity/activityStore";

export type PersonLinkOption = { id: string; number: string; name: string; isActive: boolean };
type Props = { kind: "member" | "employee"; branches: OrganizationBranch[]; clients: OrganizationClient[]; lookups?: PersonImportLookups; requireClient?: boolean; linkOptions: PersonLinkOption[]; importing: boolean; importError?: string; onClose: () => void; onImport: (rows: PersonImportRow[], branchId: string, clientId: string) => Promise<PersonImportOutcome[]> };
type Status = "all" | "ready" | "error" | "imported" | "attention";
const errorLabels = importErrorLabels;

export function PersonImportDialog({ kind, branches, clients, lookups = { departments, positions }, requireClient = false, linkOptions, importing, importError, onClose, onImport }: Props) {
  const [rows, setRows] = useState<PersonImportRow[]>([]);
  const [editingRow, setEditingRow] = useState<number | null>(null);
  const [outcomes, setOutcomes] = useState<Record<number, PersonImportOutcome>>({});
  const [fileName, setFileName] = useState(""); const [error, setError] = useState("");
  const [reading, setReading] = useState(false); const [processing, setProcessing] = useState(false); const [downloading, setDownloading] = useState(false);
  const [deploymentConfirmed, setDeploymentConfirmed] = useState(false);
  const { branchId, clientId, setBranchId, setClientId, availableClients, fixedBranch, fixedClient } = usePlacementSelection(branches.filter((item) => item.isActive), clients.filter((item) => item.isActive));
  const [linkSearch, setLinkSearch] = useState<Record<number, string>>({}); const [includeInactive, setIncludeInactive] = useState(false);
  const [filter, setFilter] = useState<Status>("all"); const [errorType, setErrorType] = useState(""); const [search, setSearch] = useState(""); const [page, setPage] = useState(1); const [pageSize, setPageSize] = useState(10);
  const busy = importing || reading || processing;
  const visibleLinkOptions = linkOptions.filter((item) => item.isActive || includeInactive).sort((a, b) => Number(b.isActive) - Number(a.isActive) || a.name.localeCompare(b.name));
  const issuesFor = (row: PersonImportRow) => {
    const errors = [...row.errors]; const types = [...row.errorTypes];
    const linked = linkOptions.find((item) => item.id === row.linkedRecordId);
    if (linked && row.personNumber && row.personNumber !== linked.number) { errors.push("Imported ID does not match the linked record ID."); types.push("identity"); }
    else if (linkSearch[row.rowNumber] && !linked) {
      const typed = linkSearch[row.rowNumber];
      const inactive = linkOptions.some((item) => !item.isActive && (typed === item.number || typed === `${item.number} - ${item.name}`));
      errors.push(inactive && !includeInactive ? "Record is inactive. Use Search inactive to select it." : "Employee/member was not found. Select a matching record or clear the link search."); types.push("identity");
    }
    const outcome = outcomes[row.rowNumber];
    if (outcome?.status === "error") { errors.push(outcome.message); types.push(outcome.errorType || "save"); }
    return { errors, types };
  };
  const statusFor = (row: PersonImportRow): Status => outcomes[row.rowNumber]?.status === "imported" ? "imported" : issuesFor(row).errors.length ? "error" : "ready";
  const readyRows = rows.filter((row) => statusFor(row) === "ready" && !outcomes[row.rowNumber]?.recordId);
  const counts = { attention: rows.filter((row) => row.warnings?.length).length, all: rows.length, ready: readyRows.length, error: rows.filter((row) => statusFor(row) === "error").length, imported: rows.filter((row) => statusFor(row) === "imported").length };
  const availableErrorTypes = [...new Set(rows.flatMap((row) => issuesFor(row).types))];
  const filtered = rows.filter((row) => (filter === "all" || (filter === "attention" ? Boolean(row.warnings?.length) : statusFor(row) === filter)) && (!errorType || issuesFor(row).types.includes(errorType as ImportErrorType)) && `${row.personNumber} ${row.firstName} ${row.lastName} ${issuesFor(row).errors.join(" ")} ${row.warnings?.join(" ")}`.toLowerCase().includes(search.toLowerCase()));
  const currentPage = Math.min(page, Math.max(1, Math.ceil(filtered.length / pageSize)));
  const pageRows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const { confirmLeave, confirmDiscard } = useUnsavedChanges(rows.some((row) => statusFor(row) !== "imported"), busy);
  const close = () => confirmLeave(onClose);
  const placementReady = Boolean(branchId && (!requireClient || clientId));
  const branch = branches.find((item) => item.id === branchId); const client = clients.find((item) => item.id === clientId);

  async function load(file?: File) {
    if (!file || !deploymentConfirmed || !placementReady) return;
    setReading(true);
    try { setRows(await withActivity("Reading and validating imported data...", async () => personRowsFromSpreadsheet(await readSpreadsheet(file), kind, lookups))); setFileName(file.name); setLinkSearch({}); setOutcomes({}); setFilter("all"); setErrorType(""); setSearch(""); setPage(1); setError(""); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Workbook could not be read."); }
    finally { setReading(false); }
  }
  async function importReady() {
    if (!placementReady || !deploymentConfirmed || busy || !readyRows.length) return;
    setProcessing(true); setError("");
    try { const results = await withActivity(`Importing ${readyRows.length} records. Keep this window open...`, () => onImport(readyRows, branchId, clientId)); setOutcomes((current) => ({ ...current, ...Object.fromEntries(results.map((item) => [item.rowNumber, item])) })); setPage(1); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Import failed."); }
    finally { setProcessing(false); }
  }
  async function downloadTemplate() { setDownloading(true); try { await downloadPersonImportTemplate(kind, lookups); } catch { setError("Template could not be generated."); } finally { setDownloading(false); } }
  async function correctRow(source: SpreadsheetRow) {
    if (editingRow === null || busy || outcomes[editingRow]?.recordId) return;
    const validated = await withActivity("Revalidating import corrections...", () => personRowsFromSpreadsheet(rows.map((row) => row.rowNumber === editingRow ? source : row.source || {}), kind, lookups));
    setRows(validated.map((row, index) => ({ ...row, rowNumber: rows[index].rowNumber, linkedRecordId: rows[index].linkedRecordId })));
    setOutcomes((current) => { const next = { ...current }; delete next[editingRow]; return next; });
  }

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/45 p-2 sm:p-3"><section role="dialog" aria-modal="true" aria-labelledby="person-import-title" className="flex h-[min(800px,94dvh)] w-full max-w-6xl flex-col overflow-hidden rounded-md bg-white shadow-2xl">
    <header className="flex shrink-0 items-center justify-between border-b border-line px-3 py-3 sm:px-4"><div><h2 id="person-import-title" className="text-sm font-bold">Import {kind === "member" ? "members" : "employees"}</h2><p className="text-[11px] text-ink/45">{deploymentConfirmed ? [branch?.label, client?.label || "Direct deployment"].filter(Boolean).join(" / ") : "Deployment"}</p></div><button type="button" className="icon-button" onClick={close} aria-label="Close import"><X className="h-4 w-4" /></button></header>
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      {!deploymentConfirmed ? <div className="space-y-4 p-4"><div className="flex items-center gap-2 text-xs font-semibold"><Building2 className="h-4 w-4 text-moss" />Deployment assignment</div><div className="responsive-fields">
        <label className="field-label">Branch<SearchableSelect aria-label="Branch" disabled={fixedBranch || busy} className="compact-control mt-1 w-full disabled:bg-paper" value={branchId} onChange={(e) => setBranchId(e.target.value)}><option value="">Select branch</option>{branches.filter((item) => item.isActive).map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</SearchableSelect></label>
        <label className="field-label">Client<SearchableSelect aria-label="Client" disabled={fixedClient || !branchId || !availableClients.length || busy} className="compact-control mt-1 w-full disabled:bg-paper" value={clientId} onChange={(e) => setClientId(e.target.value)}><option value="">{requireClient ? "Select client" : "Direct / no client"}</option>{availableClients.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</SearchableSelect></label>
      </div></div> : <>
        <div className="shrink-0 space-y-3 border-b border-line p-3 sm:p-4"><div className="flex flex-wrap items-center gap-2"><button type="button" disabled={busy} className="secondary-button" onClick={() => confirmDiscard(() => { setDeploymentConfirmed(false); setRows([]); setOutcomes({}); setFileName(""); setError(""); })}><Building2 className="h-4 w-4" />Change deployment</button><button type="button" className="secondary-button ml-auto" disabled={downloading} onClick={() => void downloadTemplate()}><Download className="h-4 w-4" />{downloading ? "Generating..." : "Download template"}</button></div>
          <label className={`flex min-w-0 items-center justify-between gap-2 rounded-md border border-dashed border-line bg-paper px-3 py-3 ${busy ? "opacity-60" : "cursor-pointer"}`}><span className="flex min-w-0 items-center gap-2"><FileSpreadsheet className="h-5 w-5 shrink-0 text-moss" /><span className="truncate text-xs font-medium">{reading ? "Validating workbook..." : fileName || "Choose Excel workbook"}</span></span><Upload className="h-4 w-4 shrink-0" /><input disabled={busy} aria-label="Excel workbook" className="sr-only" type="file" accept=".xlsx,.xlsm" onChange={(e) => { const file = e.target.files?.[0]; if (file) confirmDiscard(() => void load(file)); e.target.value = ""; }} /></label>
          {rows.length ? <><div className="grid grid-cols-2 gap-2 sm:grid-cols-5">{([['all','All rows'],['ready','Ready'],['imported','Imported'],['error','Errors'],['attention','Needs attention']] as const).map(([id,label]) => <button key={id} type="button" onClick={() => { setFilter(id); setErrorType(""); setPage(1); }} aria-pressed={filter === id} className={`rounded-md border px-3 py-2 text-left ${filter === id ? "border-moss bg-emerald-50" : "border-line bg-white"}`}><span className={`block text-base font-semibold ${id === "error" ? "text-red-700" : "text-ink"}`}>{counts[id]}</span><span className="text-[11px] text-ink/55">{label}</span></button>)}</div>
            <div className="flex flex-wrap gap-2"><label className="relative w-full min-w-0 sm:w-auto sm:min-w-[200px] sm:flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/40" /><input aria-label="Search import rows" className="compact-control w-full pl-9" value={search} placeholder="Search ID, name or error" onChange={(e) => { setSearch(e.target.value); setPage(1); }} /></label><label className="relative"><SlidersHorizontal className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink/40" /><SearchableSelect aria-label="Error type" className="compact-control w-44 pl-8" value={errorType} onChange={(e) => { setErrorType(e.target.value); setFilter(e.target.value ? "error" : "all"); setPage(1); }}><option value="">All error types</option>{availableErrorTypes.map((type) => <option key={type} value={type}>{errorLabels[type]}</option>)}</SearchableSelect></label><button type="button" className="secondary-button" onClick={() => setIncludeInactive((value) => !value)}><UserRoundSearch className="h-4 w-4" />{includeInactive ? "Hide inactive" : "Search inactive"}</button></div>
          </> : null}
        </div>
        {rows.length ? <><div className="min-h-[120px] flex-1 overflow-auto"><datalist id={`import-${kind}-links`}>{visibleLinkOptions.map((item) => <option key={item.id} value={`${item.number} - ${item.name}`} />)}</datalist><table className="w-full min-w-[1000px] text-left text-xs"><thead className="sticky top-0 z-10 bg-[#f6f8f6] text-[10px] uppercase text-ink/50"><tr><th className="px-3 py-2">Row</th><th className="px-3 py-2">ID</th><th className="px-3 py-2">Name</th><th className="px-3 py-2">Dates / contact</th><th className="px-3 py-2">Link existing {kind === "member" ? "employee" : "member"}</th><th className="px-3 py-2">Result</th></tr></thead><tbody className="divide-y divide-line">{pageRows.map((row) => {
          const linked = linkOptions.find((item) => item.id === row.linkedRecordId); const status = statusFor(row); const issues = issuesFor(row);
          return <tr key={row.rowNumber} className="cursor-pointer hover:bg-paper" onClick={(event) => { if (!(event.target as HTMLElement).closest("input,button") && !busy && status !== "imported" && !outcomes[row.rowNumber]?.recordId) setEditingRow(row.rowNumber); }}><td className="px-3 py-2 font-mono">{row.rowNumber}</td><td className="px-3 py-2 font-mono">{linked?.number || row.personNumber || "Auto"}</td><td className="px-3 py-2 font-medium"><button type="button" className="inline-flex items-center gap-1 text-left text-moss hover:underline" disabled={busy || status === "imported" || Boolean(outcomes[row.rowNumber]?.recordId)} aria-label={`Edit import row ${row.rowNumber}`} onClick={() => setEditingRow(row.rowNumber)}>{row.lastName}, {row.firstName}</button></td><td className="px-3 py-2"><p>{row.mobile || row.email || "-"}</p><p className="mt-1 text-[11px] text-ink/50">{kind === "employee" ? row.dateHired : row.membershipDate || "Today"}</p></td><td className="px-3 py-2"><div className="relative min-w-56"><Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink/35" /><input disabled={busy || status === "imported" || Boolean(outcomes[row.rowNumber]?.recordId)} aria-label={`Link row ${row.rowNumber}`} className="compact-control w-full pl-8" list={`import-${kind}-links`} value={linkSearch[row.rowNumber] ?? (linked ? `${linked.number} - ${linked.name}` : "")} placeholder="Type ID or name" onChange={(event) => { const value = event.target.value; const match = visibleLinkOptions.find((item) => value === `${item.number} - ${item.name}` || value === item.number); setLinkSearch((current) => ({ ...current, [row.rowNumber]: value })); setRows((current) => current.map((item) => item.rowNumber === row.rowNumber ? { ...item, linkedRecordId: match?.id } : item)); setOutcomes((current) => { const next = { ...current }; delete next[row.rowNumber]; return next; }); }} /></div>{linked ? <span className="mt-1 inline-flex items-center gap-1 text-[10px] text-emerald-700"><Link2 className="h-3 w-3" />{linked.number}{linked.isActive ? "" : " (inactive)"}</span> : null}</td><td className={`max-w-80 px-3 py-2 ${status === "error" ? "text-red-700" : "text-emerald-700"}`}><span className="inline-flex items-center gap-1 font-semibold">{status === "error" ? <AlertTriangle className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}{status === "imported" ? outcomes[row.rowNumber].message : status === "error" ? "Error" : "Ready"}</span>{row.warnings?.map((message, index) => <p key={`attention-${index}`} className="mt-1 break-words text-[11px] text-amber-800">{message}</p>)}{issues.errors.map((message, index) => <p key={index} className="mt-1 break-words text-[11px]">{message}</p>)}</td></tr>;
        })}</tbody></table>{!pageRows.length ? <p className="p-6 text-center text-xs text-ink/50">No matching rows.</p> : null}</div><div className="shrink-0"><PaginationControls page={currentPage} pageSize={pageSize} total={filtered.length} onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1); }} /></div></> : null}
      </>}
      {error || importError ? <p role="alert" className="flex items-start gap-2 bg-red-50 px-4 py-3 text-xs text-red-700"><AlertTriangle className="h-4 w-4 shrink-0" />{error || importError}</p> : null}
    </div>
    <footer className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-line px-3 py-3 sm:px-4"><p className="text-[11px] text-ink/50">{rows.length ? `${counts.imported} imported / ${counts.error} errors` : "No workbook loaded"}</p><div className="flex flex-wrap gap-2"><button type="button" className="secondary-button" onClick={close}><X className="h-4 w-4" />{counts.imported === rows.length && rows.length ? "Close" : "Cancel"}</button>{deploymentConfirmed ? <button type="button" className="primary-button" disabled={!readyRows.length || busy} onClick={() => void importReady()}><Upload className="h-4 w-4" />{busy ? "Processing..." : `Import ${readyRows.length} ready`}</button> : <button type="button" className="primary-button" disabled={!placementReady || busy} onClick={() => setDeploymentConfirmed(true)}>Continue<ArrowRight className="h-4 w-4" /></button>}</div></footer>
  </section>{editingRow !== null && rows.find((row) => row.rowNumber === editingRow) ? <PersonImportRowEditor key={editingRow} row={rows.find((row) => row.rowNumber === editingRow)!} kind={kind} onSave={correctRow} onClose={() => setEditingRow(null)} /> : null}</div>;
}
