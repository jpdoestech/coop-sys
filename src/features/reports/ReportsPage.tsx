import { useDeferredValue, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowDown, ArrowUp, ArrowUpDown, BriefcaseBusiness, Building2, FileDown, FileSpreadsheet, LoaderCircle, Printer, RefreshCw, RotateCcw, Search, UsersRound } from "lucide-react";
import { PageHeader } from "../../components/ui/PageHeader";
import { PaginationControls } from "../../components/ui/PaginationControls";
import { SearchableSelect } from "../../components/ui/SearchableSelect";
import { PlacementSelectors } from "../../components/forms/PlacementSelectors";
import { useAccess } from "../../services/access/useAccess";
import { useOrganization } from "../../services/organization/useOrganization";
import { createReportRepository } from "../../services/repositories/reportRepositoryFactory";
import type { ReportFilters, ReportKind, ReportSort } from "../../services/repositories/ReportRepository";
import { canExportReport, collectReportRows, emptyReport, reportCell, reportColumns, reportTitles, validateReportQuery } from "../../services/reports/reportCore";
import { memberStatuses, memberTypes } from "../members/data/memberOptions";
import { employmentStatuses, employmentTypes } from "../employees/data/employeeOptions";
import { PrintOrientationDialog, type PrintOrientation } from "../payments/components/PrintOrientationDialog";
import { openPrintReport, openPrintWindow } from "../payments/printPaymentReport";
import { withActivity } from "../../services/activity/activityStore";
import { downloadReport } from "./reportExport";

const tabs = [{ id: "members" as const, label: "Members", icon: UsersRound }, { id: "employees" as const, label: "Workforce", icon: BriefcaseBusiness }, { id: "deployment" as const, label: "Deployment", icon: Building2 }];

export function ReportsPage() {
  const { profile, can } = useAccess(), directory = useOrganization();
  const repository = useMemo(createReportRepository, []);
  const [kind, setKind] = useState<ReportKind>(() => can("members.view") ? "members" : "employees");
  const [filters, setFilters] = useState<ReportFilters>({});
  const [sort, setSort] = useState<ReportSort>("name"), [direction, setDirection] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1), [pageSize, setPageSize] = useState(25);
  const [busy, setBusy] = useState(false), [progress, setProgress] = useState(0), [actionError, setActionError] = useState("");
  const [orientationOpen, setOrientationOpen] = useState(false);
  const deferredSearch = useDeferredValue(filters.search || "");
  const request = { ...filters, search: deferredSearch, kind, sort, direction, limit: pageSize, offset: (page - 1) * pageSize };
  const source = kind === "members" ? "members" : "employees";
  const permitted = can("reports.view") && can(`${source}.view`);
  let validationError = "";
  try { validateReportQuery(request); } catch (reason) { validationError = (reason as Error).message; }
  const query = useQuery({ queryKey: ["reports", profile, request], queryFn: () => repository.listPage(request, profile), enabled: permitted && !validationError, staleTime: 30000 });
  const result = query.data || emptyReport, columns = reportColumns(kind), exportAllowed = permitted && canExportReport(profile, kind);
  const statuses = kind === "members" ? memberStatuses : employmentStatuses, types = kind === "members" ? memberTypes : employmentTypes;
  const loading = query.isFetching && !query.data;
  function update(next: Partial<ReportFilters>) { setFilters((current) => ({ ...current, ...next })); setPage(1); setActionError(""); }
  function changeTab(next: ReportKind) { setKind(next); setFilters({}); setPage(1); setSort(next === "deployment" ? "branch" : "name"); setDirection("asc"); setActionError(""); }
  function sortColumn(key: ReportSort) { setDirection(sort === key && direction === "asc" ? "desc" : "asc"); setSort(key); setPage(1); }
  const metadata = () => [`Generated: ${new Date().toLocaleString("en-PH", { timeZone: "Asia/Manila" })}`, `Prepared by: ${profile.displayName}`, `Branch: ${directory.branches.find((item) => item.id === filters.branchId)?.label || "All accessible"}`, `Client: ${directory.clients.find((item) => item.id === filters.clientId)?.label || "All accessible"}`, `Status: ${statuses.find((item) => item.id === filters.statusId)?.label || "All"}`, `Type: ${types.find((item) => item.id === filters.typeId)?.label || "All"}`, `Department: ${directory.departments.find((item) => item.id === filters.departmentId)?.label || "All"}`, `Dates: ${filters.dateFrom || "Any"} to ${filters.dateTo || "Any"}`, `BOD approval: ${filters.approval || "All"}`, `Review: ${filters.attentionOnly ? "Needs attention" : "All"}`, `Search: ${filters.search || "None"}`];
  async function produce(format: "csv" | "xlsx" | "print", orientation?: PrintOrientation) {
    if (!exportAllowed || busy || validationError) return;
    setOrientationOpen(false); setBusy(true); setProgress(0); setActionError("");
    let target: Window | undefined;
    try {
      if (format === "print") target = openPrintWindow(reportTitles[kind]);
      await withActivity("Preparing report...", async () => {
        const rows = await collectReportRows((options) => repository.listPage(options, profile), { ...request, search: filters.search || "" }, setProgress);
        if (format === "print") openPrintReport({ title: reportTitles[kind], orientation, meta: [...metadata(), `Records: ${rows.length}`], columns: columns.map((column) => ({ label: column.label, align: column.numeric ? "right" : "left" })), rows: rows.map((row) => columns.map((column) => reportCell(row, column.key, kind))) }, target);
        else await downloadReport(kind, rows, format, metadata());
      });
    } catch (reason) { target?.close(); setActionError(reason instanceof Error ? reason.message : "Report could not be generated."); }
    finally { setBusy(false); }
  }
  return <>
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><PageHeader title="Reports" /><div className="flex flex-wrap items-center gap-2"><button type="button" className="icon-button" title="Refresh report" aria-label="Refresh report" disabled={busy || query.isFetching || !permitted || Boolean(validationError)} onClick={() => void query.refetch()}><RefreshCw className={`h-4 w-4 ${query.isFetching ? "animate-spin" : ""}`} /></button>{exportAllowed ? <><button type="button" className="secondary-button" disabled={busy || !result.total || Boolean(validationError)} onClick={() => void produce("csv")}><FileDown className="h-4 w-4" />CSV</button><button type="button" className="secondary-button" disabled={busy || !result.total || Boolean(validationError)} onClick={() => void produce("xlsx")}><FileSpreadsheet className="h-4 w-4" />Excel</button><button type="button" className="primary-button" disabled={busy || !result.total || Boolean(validationError)} onClick={() => setOrientationOpen(true)}><Printer className="h-4 w-4" />Print</button></> : null}</div></div>
    <section className="overflow-hidden rounded-md border border-line bg-white" aria-label="Report workspace">
      <nav aria-label="Report views" className="flex overflow-x-auto border-b border-line px-2">{tabs.filter((tab) => can(`${tab.id === "members" ? "members" : "employees"}.view`)).map((tab) => <button type="button" key={tab.id} aria-current={kind === tab.id ? "page" : undefined} disabled={busy} className={`inline-flex h-11 shrink-0 items-center gap-2 border-b-2 px-3 text-xs font-semibold ${kind === tab.id ? "border-moss text-moss" : "border-transparent text-ink/55 hover:text-ink"}`} onClick={() => changeTab(tab.id)}><tab.icon className="h-4 w-4" />{tab.label}</button>)}</nav>
      <div className="grid grid-cols-2 divide-x divide-line border-b border-line sm:grid-cols-4">{[{ label: kind === "members" ? "Members" : "Employees", value: result.records }, { label: "Active", value: result.active }, { label: kind === "members" ? "Pending BOD approval" : kind === "deployment" ? "Placements" : "Not active", value: kind === "deployment" ? result.total : result.records - result.active }, { label: "Needs attention", value: result.attention }].map((metric, index) => <div className="min-w-0 px-3 py-2.5" key={metric.label}><p className="text-[10px] font-medium uppercase text-ink/45">{metric.label}</p><p className={`mt-1 text-lg font-semibold tabular-nums ${index === 1 ? "text-moss" : index === 3 ? "text-amber-700" : "text-ink"}`}>{query.isFetching ? "..." : metric.label === "Pending BOD approval" ? result.pending.toLocaleString() : metric.value?.toLocaleString() ?? "-"}</p></div>)}</div>
      <div className="flex flex-wrap items-center gap-2 border-b border-line p-2.5"><label className="relative w-full sm:w-60"><Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink/40" /><input aria-label="Search report" className="compact-control w-full pl-8" placeholder="Search ID, name or placement" disabled={busy} value={filters.search || ""} onChange={(e) => update({ search: e.target.value })} /></label><PlacementSelectors branchId={filters.branchId || ""} clientId={filters.clientId || ""} onBranchChange={(branchId) => update({ branchId, clientId: "" })} onClientChange={(clientId) => update({ clientId })} />
        <SearchableSelect aria-label="Report status" className="compact-control w-full sm:w-36" value={filters.statusId || ""} disabled={busy} onChange={(e) => update({ statusId: e.target.value })}><option value="">All statuses</option>{statuses.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</SearchableSelect>
        <SearchableSelect aria-label="Report type" className="compact-control w-full sm:w-36" value={filters.typeId || ""} disabled={busy} onChange={(e) => update({ typeId: e.target.value })}><option value="">All types</option>{types.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</SearchableSelect>
        {kind === "members" ? <SearchableSelect aria-label="BOD approval" className="compact-control w-full sm:w-36" disabled={busy} value={filters.approval || ""} onChange={(e) => update({ approval: e.target.value })}><option value="">All approvals</option><option value="pending">Pending</option><option value="approved">Approved</option></SearchableSelect> : <SearchableSelect aria-label="Report department" className="compact-control w-full sm:w-44" disabled={busy} value={filters.departmentId || ""} onChange={(e) => update({ departmentId: e.target.value })}><option value="">All departments</option>{directory.departments.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</SearchableSelect>}
        <button type="button" className="icon-button sm:ml-auto" title="Reset report filters" aria-label="Reset report filters" disabled={busy} onClick={() => { setFilters({}); setPage(1); setActionError(""); }}><RotateCcw className="h-4 w-4" /></button>
      </div>
      <div className="flex flex-wrap items-end gap-3 border-b border-line px-3 py-2"><label className="field-label min-w-[140px] flex-1 basis-[140px] sm:min-w-0 sm:flex-none sm:basis-auto">{kind === "members" ? "Joined from" : "Hired from"}<input type="date" aria-label="Report date from" className="compact-control mt-1 w-full sm:w-36" disabled={busy} value={filters.dateFrom || ""} onChange={(e) => update({ dateFrom: e.target.value })} /></label><label className="field-label min-w-[140px] flex-1 basis-[140px] sm:min-w-0 sm:flex-none sm:basis-auto">To<input type="date" aria-label="Report date to" className="compact-control mt-1 w-full sm:w-36" disabled={busy} value={filters.dateTo || ""} onChange={(e) => update({ dateTo: e.target.value })} /></label><label className="inline-flex h-9 items-center gap-2 text-xs text-amber-800"><input type="checkbox" disabled={busy} checked={Boolean(filters.attentionOnly)} onChange={(e) => update({ attentionOnly: e.target.checked })} />Needs attention</label><span className="ml-auto text-[11px] text-ink/45">{busy ? `${progress.toLocaleString()} rows prepared` : `${result.total.toLocaleString()} ${kind === "deployment" ? "placements" : "records"}`}</span></div>
      {actionError || validationError || query.isError || !permitted ? <p role="alert" className="flex items-center gap-2 border-b border-line bg-red-50 p-3 text-xs text-red-700"><AlertTriangle className="h-4 w-4 shrink-0" />{actionError || validationError || (query.error instanceof Error ? query.error.message : !permitted ? "No report sources are available for your account." : "Report could not be loaded.")}</p> : null}
      <div className="max-h-[58vh] overflow-auto" aria-busy={query.isFetching}><table className="w-full min-w-[860px] text-left text-xs"><thead className="sticky top-0 z-10 bg-[#f6f8f6]"><tr>{columns.map((column) => <th key={column.key} aria-sort={sort === column.key ? direction === "asc" ? "ascending" : "descending" : "none"} className={`whitespace-nowrap border-b border-line px-3 py-2 ${column.numeric ? "text-right" : ""}`}><button type="button" disabled={busy} className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase text-ink/50 hover:text-moss" onClick={() => sortColumn(column.key)}>{column.label}{sort === column.key ? direction === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" /> : <ArrowUpDown className="h-3 w-3 text-ink/25" />}</button></th>)}</tr></thead><tbody className="divide-y divide-line">{!validationError && permitted && result.items.map((row) => <tr key={row.id} className="hover:bg-paper">{columns.map((column) => <td key={column.key} className={`px-3 py-2.5 ${column.numeric ? "text-right font-mono" : column.key === "number" || column.key === "date" ? "whitespace-nowrap font-mono text-[11px]" : column.key === "name" ? "font-semibold" : ""}`}>{column.key === "attention" ? <span className={row.attention ? "text-amber-800" : "text-ink/40"}>{reportCell(row, column.key, kind)}</span> : reportCell(row, column.key, kind) || "-"}</td>)}</tr>)}{loading || !result.items.length || validationError || !permitted ? <tr><td colSpan={columns.length} className="px-3 py-12 text-center text-xs text-ink/45">{loading ? <span className="inline-flex items-center gap-2"><LoaderCircle className="h-4 w-4 animate-spin" />Loading report...</span> : "No matching records"}</td></tr> : null}</tbody></table></div>
      <PaginationControls page={page} pageSize={pageSize} total={result.total} onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1); }} />
    </section>{orientationOpen ? <PrintOrientationDialog title={reportTitles[kind]} onSelect={(orientation) => void produce("print", orientation)} onCancel={() => setOrientationOpen(false)} /> : null}
  </>;
}
