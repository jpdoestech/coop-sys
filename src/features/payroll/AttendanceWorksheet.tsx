import { useCallback, useDeferredValue, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, FileUp, Info, ListFilter, MoreHorizontal, RefreshCw, Save, Search, SlidersHorizontal } from "lucide-react";
import { useAccess } from "../../services/access/useAccess";
import { useOrganization } from "../../services/organization/useOrganization";
import { useUnsavedChanges } from "../../components/forms/unsavedChanges";
import { ToolbarDisclosure } from "../../components/ui/ToolbarDisclosure";
import { SearchableSelect } from "../../components/ui/SearchableSelect";
import { PaginationControls } from "../../components/ui/PaginationControls";
import { showTransactionSuccess } from "../../services/activity/transactionNotifications";
import { attendanceDate, attendanceMetrics, attendanceStatuses } from "../../services/payroll/attendanceCore";
import { scheduledTeamInput, type AttendanceTeamRow } from "../../services/payroll/attendanceTeam";
import { prepareWorksheetSave, teamExceptions, teamInput } from "../../services/payroll/attendanceWorksheet";
import type { AttendanceInput, AttendanceStatus } from "../../types/attendance";
import type { AttendanceRepository } from "../../services/repositories/AttendanceRepository";
import type { PayrollRepository } from "../../services/repositories/PayrollRepository";
import { PayrollLookup } from "./PayrollLookup";
import { AttendanceForm } from "./AttendanceForm";

export function AttendanceWorksheet({ repository, payroll, onImport }: { repository: AttendanceRepository; payroll: PayrollRepository; onImport: () => void }) {
  const { profile, can } = useAccess(), organization = useOrganization(), client = useQueryClient();
  const [date, setDate] = useState(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()));
  const [site, setSite] = useState({ id: "", label: "" }), [department, setDepartment] = useState(""), [search, setSearch] = useState("");
  const [page, setPage] = useState(1), [size, setSize] = useState(25), [exceptionsOnly, setExceptionsOnly] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set()), [edits, setEdits] = useState<Record<string, AttendanceInput>>({});
  const [reference, setReference] = useState(""), [error, setError] = useState(""), [detail, setDetail] = useState<AttendanceTeamRow | null>(null);
  const deferred = useDeferredValue(search), editable = can("payroll.manage");
  const query = useQuery({ queryKey: ["attendance-team", profile.userId, date, site.id, department, deferred, page, size], queryFn: () => repository.worksheet({ date, worksiteId: site.id, departmentId: department || undefined, search: deferred, limit: size, offset: (page - 1) * size }), enabled: Boolean(site.id) && attendanceDate(date), refetchOnWindowFocus: false });
  const rows = query.data?.items || [];
  const visible = rows.filter((row) => !exceptionsOnly || teamExceptions(row, edits[row.employeeId] || teamInput(row)).length > 0);
  const changeable = (row: AttendanceTeamRow) => editable && Boolean(row.terms) && row.attendance?.review_status !== "approved";
  const refresh = async () => { await client.invalidateQueries({ queryKey: ["attendance-team"] }); await client.invalidateQueries({ queryKey: ["attendance"] }); };
  const save = useMutation({ mutationFn: async () => {
    const inputs = prepareWorksheetSave(rows, edits, selected, reference);
    await repository.saveBatch(inputs);
    const saved = new Set(inputs.map((input) => input.employee_id));
    const remaining = Object.fromEntries(Object.entries(edits).filter(([id]) => !saved.has(id)));
    setEdits(remaining); setSelected(new Set()); if (!Object.keys(remaining).length) setReference("");
    await refresh(); await showTransactionSuccess("Attendance worksheet saved", `${inputs.length} daily records saved as drafts for review.`);
  } });
  const dirty = Object.keys(edits).length > 0, guard = useUnsavedChanges(dirty, save.isPending);
  function leave(action: () => void) {
    if (save.isPending) return;
    guard.confirmDiscard(() => { setEdits({}); setSelected(new Set()); setError(""); action(); });
  }
  const loadSites = useCallback(async (value: string) => (await payroll.list({ kind: "worksite", search: value, limit: 20 })).items.map((r) => ({ id: r.id, label: r.data.label })), [payroll]);
  function edit(row: AttendanceTeamRow, changes: Partial<AttendanceInput>) {
    if (!changeable(row) || save.isPending) return;
    const original = edits[row.employeeId] || teamInput(row) || { ...scheduledTeamInput(row, ""), status: "present" as const, segments: [{ time_in: "", time_out: "", in_next_day: false, out_next_day: false, break_minutes: row.terms!.data.break_minutes! }] };
    setEdits((all) => ({ ...all, [row.employeeId]: { ...original, ...changes } }));
    setSelected((ids) => new Set(ids).add(row.employeeId)); setError("");
  }
  function bulk(status: "schedule" | "absent" | "paid_leave" | "unpaid_leave") {
    const next = { ...edits };
    for (const row of visible) if (selected.has(row.employeeId) && changeable(row)) {
      const input = scheduledTeamInput(row, "");
      next[row.employeeId] = status === "schedule" ? input : { ...input, status, segments: [] };
    }
    setEdits(next); setError("");
  }
  const eligible = visible.filter(changeable), allSelected = eligible.length > 0 && eligible.every((row) => selected.has(row.employeeId));
  const pending = rows.filter((row) => selected.has(row.employeeId) && edits[row.employeeId]).length;
  return <>
    <div className="data-toolbar items-end">
      <div className="w-full sm:w-64"><PayrollLookup label="Attendance worksite" value={site.id} selectedLabel={site.label} load={loadSites} onChange={(id, label) => leave(() => { setSite({ id, label }); setPage(1); })} /></div>
      <label className="field-label w-40">Work date<input type="date" className="compact-control mt-1 w-full" value={date} disabled={save.isPending} onChange={(e) => leave(() => { setDate(e.target.value); setPage(1); })} /></label>
      <label className="relative min-w-40 flex-1 sm:max-w-64"><Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink/40" /><input className="compact-control w-full pl-8" aria-label="Search worksheet employee" placeholder="Search employee" value={search} disabled={save.isPending} onChange={(e) => leave(() => { setSearch(e.target.value); setPage(1); })} /></label>
      <ToolbarDisclosure label="Worksheet filters" icon={SlidersHorizontal} count={Number(Boolean(department))}><label className="field-label">Department<SearchableSelect className="compact-control mt-1 w-full" value={department} onChange={(e) => leave(() => { setDepartment(e.target.value); setPage(1); })}><option value="">All departments</option>{organization.departments.filter((d) => d.isActive).map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}</SearchableSelect></label></ToolbarDisclosure>
      <div className="toolbar-actions">
        <button type="button" className={`secondary-button ${exceptionsOnly ? "bg-amber-50 text-amber-800" : ""}`} aria-pressed={exceptionsOnly} onClick={() => { setExceptionsOnly(!exceptionsOnly); setSelected(new Set()); }}><ListFilter className="h-4 w-4" />Exceptions</button>
        <ToolbarDisclosure label="Worksheet notice" icon={Info}><p className="text-xs text-ink/65">Roster follows dated payroll assignments, including expired terms requiring correction. Schedule defaults are planned times, not verified punches. Exceptions apply to this page; payroll amounts are not calculated. Approved records stay locked. Independent duties within one day require a later assignment-segment workflow.</p></ToolbarDisclosure>
        <button type="button" className="icon-button" aria-label="Refresh worksheet" title="Refresh worksheet" disabled={save.isPending || query.isFetching} onClick={() => leave(() => void refresh())}><RefreshCw className="h-4 w-4" /></button>
        {editable ? <button type="button" className="secondary-button" disabled={save.isPending} onClick={() => leave(onImport)}><FileUp className="h-4 w-4" />Import</button> : null}
      </div>
    </div>
    {editable && site.id ? <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2">
      <span className="text-[11px] text-ink/55">{selected.size} selected</span>
      <button type="button" className="secondary-button" disabled={!selected.size || save.isPending} onClick={() => bulk("schedule")}><CalendarDays className="h-3.5 w-3.5" />Apply schedule</button>
      <select className="compact-control max-w-40" aria-label="Bulk attendance status" disabled={!selected.size || save.isPending} value="" onChange={(e) => bulk(e.target.value as "absent" | "paid_leave" | "unpaid_leave")}><option value="" disabled>Mark selected</option><option value="absent">Absent</option><option value="paid_leave">Paid leave</option><option value="unpaid_leave">Unpaid leave</option></select>
      <input className="compact-control min-w-48 flex-1" maxLength={1000} aria-label="Worksheet attendance reference" placeholder="Attendance / correction reference" value={reference} disabled={save.isPending} onChange={(e) => setReference(e.target.value)} />
      <button type="button" className="primary-button" disabled={!pending || save.isPending || query.isFetching} onClick={() => { setError(""); save.mutate(); }}><Save className="h-3.5 w-3.5" />{save.isPending ? "Saving..." : `Save ${pending} changed`}</button>
    </div> : null}
    {query.isError || save.isError || error || !attendanceDate(date) ? <p role="alert" className="border-b border-line bg-red-50 px-3 py-2 text-xs text-red-700">{query.error?.message || save.error?.message || error || "Select a valid work date."}</p> : null}
    <div className="max-h-[65vh] overflow-auto" aria-busy={query.isFetching}><table className="w-full min-w-[1250px] text-left text-xs">
      <thead className="sticky top-0 z-10 bg-[#f6f8f6]"><tr><th className="px-3 py-2"><input type="checkbox" aria-label="Select editable rows on this page" checked={allSelected} disabled={!eligible.length || save.isPending} onChange={(e) => setSelected(e.target.checked ? new Set(eligible.map((r) => r.employeeId)) : new Set())} /></th>{["Employee / duty", "Scheduled shift", "Status", "Time in", "Time out", "Break min", "Hours", "Review / exceptions", ""].map((h) => <th key={h} className="whitespace-nowrap px-3 py-2 text-[10px] uppercase text-ink/50">{h}</th>)}</tr></thead>
      <tbody className="divide-y divide-line">{visible.map((row) => {
        const input = edits[row.employeeId] || teamInput(row), flags = teamExceptions(row, input), segment = input?.segments[0];
        const locked = !changeable(row) || save.isPending || query.isFetching, multi = (input?.segments.length || 0) > 1;
        const metrics = row.terms && input ? attendanceMetrics(input, row.terms.data) : null;
        const punch = (changes: Partial<NonNullable<typeof segment>>) => segment && edit(row, { segments: [{ ...segment, ...changes }] });
        return <tr key={row.employeeId} className={edits[row.employeeId] ? "bg-emerald-50/50" : "hover:bg-paper"}>
          <td className="px-3 py-2"><input type="checkbox" aria-label={`Select ${row.employeeLabel}`} disabled={locked} checked={selected.has(row.employeeId)} onChange={(e) => setSelected((ids) => { const next = new Set(ids); if (e.target.checked) next.add(row.employeeId); else next.delete(row.employeeId); return next; })} /></td>
          <td className="max-w-60 px-3 py-2"><p className="font-semibold">{row.employeeLabel}</p><p className="mt-1 text-[11px] text-ink/50">{row.terms?.data.label || "Terms unavailable"}</p></td>
          <td className="whitespace-nowrap px-3 py-2 font-mono">{row.terms ? `${row.terms.data.shift_start} - ${row.terms.data.shift_end}` : "-"}{row.restDay ? <p className="mt-1 font-sans text-[10px] text-ink/50">Rest day</p> : null}</td>
          <td className="px-3 py-2"><select aria-label={`Status ${row.employeeLabel}`} className="compact-control w-32" value={input?.status || ""} disabled={locked || multi} onChange={(e) => {
            const status = e.target.value as AttendanceStatus;
            edit(row, { status, segments: status === "present" ? input?.segments.length ? input.segments : [{ time_in: "", time_out: "", in_next_day: false, out_next_day: false, break_minutes: row.terms!.data.break_minutes! }] : [] });
          }}><option value="" disabled>Unrecorded</option>{attendanceStatuses.map((s) => <option value={s} key={s}>{s.replaceAll("_", " ")}</option>)}</select></td>
          <td className="px-3 py-2"><input aria-label={`Time in ${row.employeeLabel}`} type="time" className="compact-control w-28" value={segment?.time_in || ""} disabled={locked || multi || input?.status !== "present"} onInput={(e) => punch({ time_in: e.currentTarget.value })} onChange={(e) => punch({ time_in: e.target.value })} /><label className="mt-1 flex items-center gap-1 text-[10px] text-ink/55"><input type="checkbox" aria-label={`Time in next day ${row.employeeLabel}`} checked={segment?.in_next_day || false} disabled={locked || multi || !segment} onChange={(e) => punch({ in_next_day: e.target.checked })} />Next day</label></td>
          <td className="px-3 py-2"><input aria-label={`Time out ${row.employeeLabel}`} type="time" className="compact-control w-28" value={segment?.time_out || ""} disabled={locked || multi || input?.status !== "present"} onInput={(e) => punch({ time_out: e.currentTarget.value })} onChange={(e) => punch({ time_out: e.target.value })} /><label className="mt-1 flex items-center gap-1 text-[10px] text-ink/55"><input type="checkbox" aria-label={`Time out next day ${row.employeeLabel}`} checked={segment?.out_next_day || false} disabled={locked || multi || !segment} onChange={(e) => punch({ out_next_day: e.target.checked })} />Next day</label></td>
          <td className="px-3 py-2"><input aria-label={`Break minutes ${row.employeeLabel}`} type="number" min="0" step="1" className="compact-control w-20" value={segment?.break_minutes ?? ""} disabled={locked || multi || !segment} onChange={(e) => punch({ break_minutes: Number(e.target.value) })} /></td>
          <td className="px-3 py-2 font-mono">{metrics && Number.isFinite(metrics.worked) ? (metrics.worked / 60).toFixed(2) : "-"}</td>
          <td className="min-w-48 max-w-72 px-3 py-2"><p className={`text-[11px] font-semibold ${row.attendance?.review_status === "approved" ? "text-moss" : "text-ink/50"}`}>{edits[row.employeeId] ? "Unsaved changes" : row.attendance?.review_status || "Not recorded"}</p><p className="mt-1 text-[10px] text-amber-800">{flags.join(" · ")}</p></td>
          <td className="px-3 py-2">{editable && row.terms && row.attendance?.review_status !== "approved" ? <button type="button" className="icon-button" aria-label={`Attendance details ${row.employeeLabel}`} title="Work segments / correction details" disabled={save.isPending} onClick={() => leave(() => setDetail(row))}><MoreHorizontal className="h-4 w-4" /></button> : null}</td>
        </tr>;
      })}{!visible.length ? <tr><td colSpan={10} className="px-3 py-12 text-center text-ink/45">{!site.id ? "Select a worksite to load its dated team" : query.isFetching ? "Loading team..." : exceptionsOnly ? "No exceptions on this page" : "No dated payroll assignments for these filters"}</td></tr> : null}</tbody>
    </table></div>
    {exceptionsOnly ? <p className="border-t border-line px-3 py-2 text-[11px] text-ink/55">{visible.length} exceptions among {rows.length} employees on this page</p> : null}
    <PaginationControls page={page} pageSize={size} total={query.data?.total || 0} onPageChange={(next) => leave(() => setPage(next))} onPageSizeChange={(next) => leave(() => { setSize(next); setPage(1); })} />
    {detail ? <AttendanceForm repository={repository} payroll={payroll} source={detail.attendance || undefined} initial={{ employeeId: detail.employeeId, employeeLabel: detail.employeeLabel, date: detail.date }} onClose={() => setDetail(null)} refresh={refresh} /> : null}
  </>;
}
