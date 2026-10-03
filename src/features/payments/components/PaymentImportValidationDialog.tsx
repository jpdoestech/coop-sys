import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, FileCheck2, Link2, Search, UserCheck, X } from "lucide-react";
import type { Employee } from "../../../types/employee";
import type { PaymentImportMatch } from "../../../types/payment";
import { EMPLOYMENT_STATUS } from "../../../services/lookups/statuses";
import { employeeFullName } from "../../../services/imports/identityMatching";
import { PaginationControls } from "../../../components/ui/PaginationControls";

type MatchFilter = "all" | "id" | "name" | "alias" | "manual" | "attention";
type Props = {
  matches: PaymentImportMatch[];
  employees: Employee[];
  overrides: Record<number, string>;
  overrideSearch: Record<number, string>;
  fileName: string;
  scopeLabel: string;
  periodLabel: string;
  includeInactive: boolean;
  saving: boolean;
  error: string;
  onClose: () => void;
  onToggleInactive: () => void;
  onAmountChange: (rowNumber: number, amountCentavos: number) => void;
  onSearchChange: (rowNumber: number, value: string, employeeId: string) => void;
  onSaveAlias: (row: PaymentImportMatch) => Promise<void>;
  onPost: () => void;
};

function optionValue(employee: Employee) {
  return `${employee.employee_number} - ${employeeFullName(employee)}${employee.employment_status_id === EMPLOYMENT_STATUS.active ? "" : " (inactive)"}`;
}

export function PaymentImportValidationDialog({ matches, employees, overrides, overrideSearch, fileName, scopeLabel, periodLabel, includeInactive, saving, error, onClose, onToggleInactive, onAmountChange, onSearchChange, onSaveAlias, onPost }: Props) {
  const [filter, setFilter] = useState<MatchFilter>("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const resolvedEmployee = (row: PaymentImportMatch) => employees.find((employee) => employee.id === (row.employeeId ?? overrides[row.rowNumber]));
  const ready = (row: PaymentImportMatch) => Boolean(resolvedEmployee(row)?.member_id);
  const counts = {
    all: matches.length,
    id: matches.filter((row) => row.matchedBy === "id" && ready(row)).length,
    name: matches.filter((row) => row.matchedBy === "name" && ready(row)).length,
    alias: matches.filter((row) => row.matchedBy === "alias" && ready(row)).length,
    manual: matches.filter((row) => !row.employeeId && ready(row)).length,
    attention: matches.filter((row) => !ready(row)).length,
  };
  const filtered = matches.filter((row) => filter === "all" || filter === "attention" ? filter === "all" || !ready(row) : filter === "manual" ? !row.employeeId && ready(row) : row.matchedBy === filter && ready(row));
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);
  const resolvedCount = matches.filter(ready).length;

  useEffect(() => setPage(1), [filter, pageSize, matches.length]);
  useEffect(() => {
    const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
    if (page > pages) setPage(pages);
  }, [filtered.length, page, pageSize]);

  const cards: Array<{ id: MatchFilter; label: string; value: number; tone: string }> = [
    { id: "all", label: "All rows", value: counts.all, tone: "text-ink" },
    { id: "id", label: "ID matched", value: counts.id, tone: "text-sky-700" },
    { id: "name", label: "Name matched", value: counts.name, tone: "text-emerald-700" },
    { id: "alias", label: "Alias matched", value: counts.alias, tone: "text-violet-700" },
    { id: "manual", label: "Manual link", value: counts.manual, tone: "text-indigo-700" },
    { id: "attention", label: "Needs attention", value: counts.attention, tone: "text-amber-700" },
  ];

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/45 p-2 sm:p-4">
    <section className="flex h-[min(800px,95vh)] w-full max-w-7xl flex-col overflow-hidden rounded-md border border-line bg-white shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="payment-import-review-title">
      <header className="flex shrink-0 items-start justify-between gap-4 border-b border-line px-4 py-2.5 sm:px-5">
        <div className="flex min-w-0 items-start gap-2.5"><span className="grid h-8 w-8 shrink-0 place-items-center rounded bg-moss/10 text-moss"><FileCheck2 className="h-4 w-4" /></span><div className="min-w-0"><h2 id="payment-import-review-title" className="text-sm font-semibold">Payroll import validation</h2><p className="truncate text-xs text-ink/50">{fileName} · {scopeLabel} · {periodLabel}</p></div></div>
        <button type="button" onClick={onClose} className="icon-button" aria-label="Close validation preview"><X className="h-4 w-4" /></button>
      </header>

      <div className="shrink-0 overflow-x-auto border-b border-line bg-[#fafcfb] p-2"><div className="grid min-w-[840px] grid-cols-6 gap-1.5">{cards.map((card) => <button key={card.id} type="button" onClick={() => setFilter(card.id)} className={`rounded-md border px-2.5 py-1.5 text-left transition ${filter === card.id ? "border-moss bg-white shadow-sm ring-1 ring-moss/15" : "border-line bg-white/70 hover:border-moss/40"}`}><span className={`block text-base font-semibold leading-5 ${card.tone}`}>{card.value}</span><span className="text-[10px] font-bold uppercase text-ink/45">{card.label}</span></button>)}</div></div>

      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-line px-4 py-2"><div className="flex items-center gap-2 text-xs text-ink/55"><UserCheck className="h-4 w-4 text-moss" /><strong className="text-ink">{resolvedCount}/{matches.length}</strong> ready to post</div><button type="button" className="secondary-button ml-auto" onClick={onToggleInactive}><Search className="h-4 w-4" />{includeInactive ? "Active employees only" : "Load inactive employees"}</button></div>
      {error ? <p className="flex shrink-0 items-center gap-2 border-b border-red-100 bg-red-50 px-4 py-2 text-xs text-red-700"><AlertTriangle className="h-4 w-4" />{error}</p> : null}

      <div className="min-h-0 flex-1 overflow-auto">
        <datalist id="payment-import-employee-search">{employees.map((employee) => <option key={employee.id} value={optionValue(employee)} />)}</datalist>
        <table className="w-full min-w-[1040px] table-fixed text-left text-xs">
          <thead className="sticky top-0 z-10 bg-[#f6f8f6] text-[10px] uppercase text-ink/45"><tr><th className="w-14 px-3 py-2">Row</th><th className="w-64 px-3 py-2">Imported ID / name</th><th className="w-28 px-3 py-2">Amount</th><th className="w-52 px-3 py-2">Match evidence</th><th className="px-3 py-2">Resolved employee</th></tr></thead>
          <tbody className="divide-y divide-line">{pageRows.map((row) => {
            const employee = resolvedEmployee(row); const isReady = Boolean(employee?.member_id);
            const evidence = row.matchedBy === "id" ? "Exact employee ID" : row.matchedBy === "name" ? "Exact legal name" : row.matchedBy === "alias" ? "Saved payroll alias" : employee ? "Manual employee link" : "No exact match";
            return <tr key={row.rowNumber} className={isReady ? "hover:bg-[#fafcfb]" : "bg-amber-50/35 hover:bg-amber-50/60"}>
              <td className="px-3 py-1.5 font-mono text-ink/55">{row.rowNumber}</td>
              <td className="px-3 py-1.5"><span className="block truncate font-semibold" title={row.name}>{row.name || "No imported name"}</span><span className="block font-mono text-[11px] leading-4 text-ink/45">{row.id || "No imported ID"}</span></td>
              <td className="px-3 py-1.5"><input className="compact-control h-8 w-24 font-mono" type="number" min="0.01" step="0.01" defaultValue={(row.amountCentavos / 100).toFixed(2)} aria-label={`Amount for row ${row.rowNumber}`} onBlur={(event) => { const cents = Math.round(Number(event.target.value) * 100); if (cents > 0) onAmountChange(row.rowNumber, cents); }} /></td>
              <td className="px-3 py-1.5"><span className={`inline-flex items-center gap-1 font-medium ${isReady ? "text-emerald-700" : "text-amber-700"}`}>{isReady ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}{evidence}</span>{row.matchedBy ? <span className="block text-[10px] leading-4 uppercase text-ink/40">100% {row.matchedBy} match</span> : <span className="block text-[10px] leading-4 text-ink/45">{row.error}</span>}</td>
              <td className="px-3 py-1.5">{row.employeeId && employee ? <div><span className="block font-semibold">{employee.employee_number} · {employeeFullName(employee)}</span><span className="text-[11px] leading-4 text-ink/45">{employee.employment_status_id === EMPLOYMENT_STATUS.active ? "Active employee" : "Inactive employee"}{employee.member_id ? " · Member linked" : " · No member link"}</span></div> : <div className="flex items-center gap-2"><div className="relative min-w-0 flex-1"><Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink/35" /><input className="compact-control h-8 w-full pl-8" list="payment-import-employee-search" placeholder="Type employee ID or name" value={overrideSearch[row.rowNumber] ?? ""} onChange={(event) => { const next = event.target.value; const match = employees.find((item) => optionValue(item) === next || item.employee_number === next); onSearchChange(row.rowNumber, next, match?.id ?? ""); }} /></div><button type="button" disabled={!overrides[row.rowNumber]} className="secondary-button h-8 whitespace-nowrap px-2.5" onClick={() => void onSaveAlias(row)}><Link2 className="h-3.5 w-3.5" /> Save alias</button></div>}</td>
            </tr>;
          })}</tbody>
        </table>
        {!pageRows.length ? <p className="p-10 text-center text-sm text-ink/50">No rows match this status.</p> : null}
      </div>

      <div className="shrink-0"><PaginationControls page={page} pageSize={pageSize} total={filtered.length} onPageChange={setPage} onPageSizeChange={setPageSize} /></div>
      <footer className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-line bg-paper/50 px-4 py-2"><button type="button" className="secondary-button" onClick={onClose}><X className="h-4 w-4" /> Close</button><button type="button" disabled={resolvedCount !== matches.length || saving} onClick={onPost} className="primary-button"><CheckCircle2 className="h-4 w-4" />{saving ? "Posting..." : `Post ${matches.length} deductions`}</button></footer>
    </section>
  </div>;
}
