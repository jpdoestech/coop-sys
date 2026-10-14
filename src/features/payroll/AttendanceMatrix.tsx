import { useEffect, useMemo, useRef, useState, type PointerEvent, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, CalendarDays, Check, Clock3, Coffee, Info, LockKeyhole, Redo2, RefreshCw, Save, Settings2, Undo2, UserCheck, UserX } from "lucide-react";
import { useAccess } from "../../services/access/useAccess";
import type { PayrollRun } from "../../types/payrollRun";
import type { AttendanceInput, AttendanceStatus } from "../../types/attendance";
import type { AttendanceTeamRow } from "../../services/payroll/attendanceTeam";
import type { PayrollRunRepository } from "../../services/repositories/PayrollRunRepository";
import type { AttendanceRepository } from "../../services/repositories/AttendanceRepository";
import { matrixDefault, matrixEditable, matrixEmployees, matrixInput, matrixKey, matrixSummary, prepareMatrixSave } from "../../services/payroll/attendanceMatrix";
import { attendanceLabel, attendanceMetrics } from "../../services/payroll/attendanceCore";
import { loadAttendancePreferences } from "../../services/payroll/attendancePreferences";
import { runDates } from "../../services/payroll/payrollRuns";
import { currentCalculationRule } from "../../services/payroll/payrollCalculation";
import { useUnsavedChanges } from "../../components/forms/unsavedChanges";
import { ToolbarDisclosure } from "../../components/ui/ToolbarDisclosure";
import { PaginationControls } from "../../components/ui/PaginationControls";
import { showTransactionSuccess } from "../../services/activity/transactionNotifications";
import { AttendancePreferencesControl } from "./AttendancePreferencesControl";
import { AttendanceTimeAdjustment } from "./AttendanceTimeAdjustment";
type Brush = "present" | "absent" | "leave" | "rest_day" | "awol" | "late";
type Edits = Record<string, AttendanceInput>;
const brushes = [{ id: "present", label: "Present", icon: UserCheck }, { id: "absent", label: "Absent", icon: UserX }, { id: "leave", label: "Leave", icon: CalendarDays }, { id: "rest_day", label: "Day-off", icon: Coffee }, { id: "awol", label: "AWOL / AWOP", icon: Ban }, { id: "late", label: "Late / Undertime", icon: Clock3 }] as const;
export function AttendanceMatrix({ run, repository, attendance, tools, employeeSearch = "" }: { run: PayrollRun; repository: PayrollRunRepository; attendance: AttendanceRepository; tools?: ReactNode; employeeSearch?: string }) {
  const { profile, can } = useAccess(), client = useQueryClient();
  const [page, setPage] = useState(1), [size, setSize] = useState(25), [brush, setBrush] = useState<Brush>("present"), [leaveType, setLeaveType] = useState<"paid_leave" | "unpaid_leave">("unpaid_leave");
  const [edits, setEdits] = useState<Edits>({}), [history, setHistory] = useState<Edits[]>([]), [redo, setRedo] = useState<Edits[]>([]), [selected, setSelected] = useState<Set<string>>(new Set());
  const [reference, setReference] = useState(""), [error, setError] = useState(""), [detail, setDetail] = useState<AttendanceTeamRow[] | null>(null);
  const [range, setRange] = useState<[number, number, number, number] | null>(null), [menu, setMenu] = useState<{ row: AttendanceTeamRow; x: number; y: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const gesture = useRef<{ row: number; column: number; endRow: number; endColumn: number; base: Edits; pointer: number } | null>(null), editsRef = useRef(edits); editsRef.current = edits;
  useEffect(() => {
    if (!menu) return;
    menuRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const outside = (e: globalThis.PointerEvent) => { if (!menuRef.current?.contains(e.target as Node)) setMenu(null); };
    const escape = (e: KeyboardEvent) => { if (e.key === "Escape") setMenu(null); };
    document.addEventListener("pointerdown", outside); document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, [menu]);
  const query = useQuery({ queryKey: ["attendance-matrix", profile.userId, run.id, page, size, employeeSearch], queryFn: () => repository.previewSource(run.id, size, (page - 1) * size, employeeSearch), refetchOnWindowFocus: false });
  const preferences = useQuery({ queryKey: ["attendance-preferences", profile.userId], queryFn: () => loadAttendancePreferences(profile) });
  const dates = useMemo(() => runDates(run), [run]), employees = useMemo(() => query.data ? matrixEmployees(query.data) : [], [query.data]);
  const calendar = useMemo(() => Object.fromEntries(dates.flatMap((date) => { const rule = currentCalculationRule(query.data?.rules || [], date, "calendar", ""); return rule ? [[date, rule.day_type!]] : []; })), [dates, query.data]);
  const blankMode = preferences.data?.blank_mode || "present", editable = can("payroll.manage"), changed = Object.keys(edits).length;
  const refresh = async () => { for (const key of ["attendance-matrix", "attendance-team", "attendance", "payroll-run-coverage", "payroll-calculation-preview", "payroll-setup", "payroll-work-date"]) await client.invalidateQueries({ queryKey: [key] }); };
  const mutation = useMutation({ mutationFn: async () => {
    if (!query.data || query.isFetching || preferences.isPending || preferences.isError) throw new Error("Wait for the cutoff and preferences to load.");
    const inputs = prepareMatrixSave(query.data.rows, edits, reference.trim() || `Manual DTR - ${run.title}`);
    await attendance.saveCutoffBatch(run.id, inputs);
    setEdits({}); editsRef.current = {}; setHistory([]); setRedo([]); setSelected(new Set()); setReference("");
    await refresh(); await showTransactionSuccess("Cutoff attendance saved", `${inputs.length} daily attendance records saved as drafts for review.`);
  } });
  const guard = useUnsavedChanges(changed > 0 || Boolean(detail), mutation.isPending);
  const busy = mutation.isPending || query.isFetching || preferences.isPending || preferences.isError;
  function leave(action: () => void) { if (!mutation.isPending) guard.confirmDiscard(() => { gesture.current = null; setRange(null); setMenu(null); setEdits({}); editsRef.current = {}; setHistory([]); setRedo([]); setSelected(new Set()); setDetail(null); setError(""); action(); }); }
  function remember() { const frame = editsRef.current; setHistory((frames) => [...frames.slice(-19), frame]); setRedo([]); }
  function undoChange() {
    const current = editsRef.current, prior = history.at(-1)!;
    setRedo((frames) => [...frames, current]); editsRef.current = prior; setEdits(prior); setHistory((frames) => frames.slice(0, -1));
  }
  function redoChange() {
    const current = editsRef.current, next = redo.at(-1)!;
    setHistory((frames) => [...frames, current]); editsRef.current = next; setEdits(next); setRedo((frames) => frames.slice(0, -1));
  }
  function paint(rowIndex: number, colIndex: number, base: Edits, startRow = rowIndex, startCol = colIndex) {
    const next = { ...base }, status: AttendanceStatus = brush === "leave" ? leaveType : brush === "late" ? "present" : brush;
    for (let r = Math.min(startRow, rowIndex); r <= Math.max(startRow, rowIndex); r++) for (let c = Math.min(startCol, colIndex); c <= Math.max(startCol, colIndex); c++) {
      const row = employees[r]?.days[dates[c]];
      if (matrixEditable(row) && row) next[matrixKey(row.employeeId, row.date)] = matrixInput(row, status);
    }
    if (Object.keys(next).length > 3100) { setError("Save the current 3,100 dates before adding more."); return; }
    editsRef.current = next; setEdits(next); setError("");
  }
  function start(e: PointerEvent<HTMLButtonElement>, r: number, c: number) {
    if (!editable || busy || e.button !== 0 || !matrixEditable(employees[r]?.days[dates[c]])) return;
    e.preventDefault(); setMenu(null);
    gesture.current = { row: r, column: c, endRow: r, endColumn: c, base: editsRef.current, pointer: e.pointerId };
    e.currentTarget.setPointerCapture(e.pointerId);
    if (brush === "late") setRange([r, c, r, c]); else { remember(); paint(r, c, editsRef.current); }
  }
  function drag(e: PointerEvent<HTMLButtonElement>) {
    const g = gesture.current; if (!g || g.pointer !== e.pointerId) return;
    const cell = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>("[data-matrix-row]");
    if (cell) {
      const r = Number(cell.dataset.matrixRow), c = Number(cell.dataset.matrixColumn);
      if (r === g.endRow && c === g.endColumn) return;
      g.endRow = r; g.endColumn = c;
      if (brush === "late") setRange([g.row, g.column, r, c]); else paint(r, c, g.base, g.row, g.column);
    }
  }
  function finish() {
    const g = gesture.current; gesture.current = null; setRange(null);
    if (!g || brush !== "late") return;
    const rows: AttendanceTeamRow[] = [];
    for (let r = Math.min(g.row, g.endRow); r <= Math.max(g.row, g.endRow); r++) for (let c = Math.min(g.column, g.endColumn); c <= Math.max(g.column, g.endColumn); c++) {
      const row = employees[r]?.days[dates[c]]; if (row && matrixEditable(row)) rows.push(row);
    }
    if (rows.length) setDetail(rows);
  }
  function quick(row: AttendanceTeamRow, next: Brush) {
    setMenu(null);
    if (!editable || busy || !matrixEditable(row)) return;
    if (next === "late") { setDetail([row]); return; }
    remember(); const input = matrixInput(row, next === "leave" ? leaveType : next), changed = { ...editsRef.current, [matrixKey(row.employeeId, row.date)]: input };
    editsRef.current = changed; setEdits(changed);
  }
  function confirmDefaults() {
    if (busy) return;
    remember(); const next = { ...editsRef.current };
    for (const employee of employees) if (!selected.size || selected.has(employee.id)) for (const row of Object.values(employee.days)) {
      const key = matrixKey(row.employeeId, row.date), status = matrixDefault(row, blankMode, calendar[row.date]);
      if (!next[key] && matrixEditable(row) && status) next[key] = matrixInput(row, status);
    }
    editsRef.current = next; setEdits(next); setError("");
  }
  const styleFor = (status?: string, assumed = false) => status === "absent" || status === "awol" ? assumed ? "text-red-300" : "bg-red-50 text-red-700" : status === "rest_day" ? "bg-ink/5 text-ink/55" : status?.includes("leave") ? "bg-sky-50 text-sky-700" : assumed ? "text-ink/25" : "bg-emerald-50 text-moss";
  return <div className="flex min-h-0 flex-1 flex-col">
    <div className="data-toolbar"><div role="radiogroup" aria-label="Attendance transaction" className="flex flex-wrap items-center gap-1">{brushes.map(({ id, label, icon: Icon }) => <button type="button" role="radio" aria-checked={brush === id} key={id} title={label} disabled={!editable || mutation.isPending} className={`inline-flex h-8 items-center gap-1.5 rounded px-2 text-[11px] font-semibold ${brush === id ? "bg-moss text-white" : "text-ink/65 hover:bg-paper"}`} onClick={() => setBrush(id)}><Icon className="h-3.5 w-3.5" />{label}</button>)}</div>{brush === "leave" ? <select className="compact-control max-w-40" aria-label="Leave treatment" value={leaveType} onChange={(e) => setLeaveType(e.target.value as typeof leaveType)}><option value="unpaid_leave">Unpaid leave</option><option value="paid_leave">Paid leave</option></select> : null}<div className="toolbar-actions">{tools}<ToolbarDisclosure label="My attendance preferences" icon={Settings2}><AttendancePreferencesControl beforeChange={(action) => leave(action)} /></ToolbarDisclosure><ToolbarDisclosure label="Matrix attendance notice" icon={Info}><p className="text-xs text-ink/65">Blank working days are unconfirmed defaults for this account, not saved attendance. Day-offs follow dated schedules. Confirm defaults stages drafts; payroll approval remains separate. Totals include assumptions and are not payable-day certification. An unscheduled day-off creates a dated schedule override atomically. Known non-ordinary calendar dates require an explicit transaction. AWOL/AWOP is absent without permission. Holiday pay rules remain separate.</p></ToolbarDisclosure><button type="button" className="icon-button" title="Refresh matrix" aria-label="Refresh matrix" disabled={mutation.isPending || query.isFetching} onClick={() => leave(() => void refresh())}><RefreshCw className="h-4 w-4" /></button></div></div>
    <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2">
      <span className="text-[11px] text-ink/55">Blank: {blankMode === "present" ? "assumed present" : "assumed absent"}</span><span className="text-[11px] font-semibold text-moss">{changed} changed days</span>
      {editable ? <>
        <button type="button" className="secondary-button" disabled={busy || !employees.length} onClick={confirmDefaults}><Check className="h-3.5 w-3.5" />Confirm {selected.size ? "selected" : "page"} defaults</button>
        <button type="button" className="icon-button" aria-label="Undo attendance changes" title="Undo" disabled={busy || !history.length} onClick={undoChange}><Undo2 className="h-4 w-4" /></button>
        <button type="button" className="icon-button" aria-label="Redo attendance changes" title="Redo" disabled={busy || !redo.length} onClick={redoChange}><Redo2 className="h-4 w-4" /></button>
        <input aria-label="Cutoff DTR reference" className="compact-control min-w-40 flex-1" placeholder="DTR reference (optional)" maxLength={1000} value={reference} disabled={mutation.isPending} onChange={(e) => setReference(e.target.value)} />
        <button type="button" className="primary-button" disabled={busy || !changed} onClick={() => { setError(""); mutation.mutate(); }}><Save className="h-4 w-4" />{mutation.isPending ? "Saving..." : "Save draft"}</button>
      </> : null}
    </div>
    {error || query.isError || mutation.isError || preferences.isError ? <p role="alert" className="border-b border-line bg-red-50 px-3 py-2 text-xs text-red-700">{error || query.error?.message || mutation.error?.message || preferences.error?.message}</p> : null}
    <div className="min-h-0 flex-1 overflow-auto" aria-busy={query.isFetching}><table className="w-full table-fixed border-collapse text-center text-xs" style={{ minWidth: 256 + dates.length * 58 + 7 * 64 }}><colgroup><col style={{ width: 256 }} />{dates.map((d) => <col key={d} style={{ width: 58 }} />)}{[1, 2, 3, 4, 5, 6, 7].map((n) => <col key={n} style={{ width: 64 }} />)}</colgroup><thead className="sticky top-0 z-20 bg-[#f6f8f6]"><tr><th className="sticky left-0 z-30 border-b border-r border-line bg-[#f6f8f6] p-2 text-left"><div className="flex items-center gap-2">{editable ? <input type="checkbox" aria-label="Select employees on matrix page" checked={employees.length > 0 && employees.every((e) => selected.has(e.id))} onChange={(e) => setSelected(e.target.checked ? new Set(employees.map((v) => v.id)) : new Set())} /> : null}<span>Employee</span></div></th>{dates.map((date) => { const type = calendar[date]; return <th key={date} title={type ? type.replaceAll("_", " ") : date} className={`border-b border-r border-line px-1 py-2 ${type && type !== "ordinary" ? "bg-amber-50 text-amber-800" : "text-ink/65"}`}><span className="block font-mono text-[11px]">{date.slice(5)}</span><span className="mt-1 block text-[10px] font-normal">{new Date(`${date}T00:00:00Z`).toLocaleDateString("en", { weekday: "short", timeZone: "UTC" })}</span>{type && type !== "ordinary" ? <span className="mt-1 block text-[9px]">{type === "suspended" ? "Suspended" : type === "regular_holiday" ? "Legal" : "Special"}</span> : null}</th>; })}{["Absent", "Day-off", "Leave", "AWOL/P", "Present days", "Late min", "UT min"].map((h) => <th key={h} className="break-words border-b border-r border-line bg-amber-50 px-1 py-2 text-[10px] uppercase text-ink/65">{h}</th>)}</tr></thead><tbody>{employees.map((employee, r) => { const summary = matrixSummary(employee, edits, blankMode, calendar); return <tr key={employee.id}><th className="sticky left-0 z-10 border-b border-r border-line bg-white px-2 py-1 text-left"><div className="flex items-start gap-2">{editable ? <input type="checkbox" aria-label={`Select matrix employee ${employee.label}`} checked={selected.has(employee.id)} onChange={(e) => setSelected((ids) => { const next = new Set(ids); if (e.target.checked) next.add(employee.id); else next.delete(employee.id); return next; })} /> : null}<div className="min-w-0"><p className="break-words font-semibold" title={`${summary.unconfirmed} unconfirmed dates`}>{employee.label}</p></div></div></th>{dates.map((date, c) => {
      const row = employee.days[date], key = matrixKey(employee.id, date), edit = edits[key], input = edit || row?.attendance, assumed = row ? matrixDefault(row, blankMode, calendar[date]) : null, status = input?.status || assumed;
      const metrics = row?.terms && input?.status === "present" ? attendanceMetrics(input, row.terms.data) : null;
      const label = metrics?.late || metrics?.earlyDeparture ? [metrics.late ? `L ${metrics.late}m` : "", metrics.earlyDeparture ? `UT ${metrics.earlyDeparture}m` : ""].filter(Boolean).join(" / ") : status === "absent" ? "ABSENT" : status === "awol" ? "AWOL/P" : status === "rest_day" ? "DAY-OFF" : status?.includes("leave") ? "LEAVE" : input ? "P" : "";
      const highlighted = range && r >= Math.min(range[0], range[2]) && r <= Math.max(range[0], range[2]) && c >= Math.min(range[1], range[3]) && c <= Math.max(range[1], range[3]);
      const locked = !editable || busy || !matrixEditable(row), hint = !row ? "Outside assignment" : !row.terms ? "Missing / expired terms" : row.attendance?.review_status === "approved" ? `Approved ${attendanceLabel(row.attendance.status)}` : `${input ? attendanceLabel(input.status) : assumed ? `Unconfirmed ${attendanceLabel(assumed)}` : "Unrecorded"}${row.attendance && row.terms.id !== row.attendance.terms_id ? " / Terms changed" : ""}`;
      return <td key={date} className="border-b border-r border-line p-0"><button type="button" data-matrix-row={r} data-matrix-column={c} aria-label={`${employee.label} ${date}: ${hint}`} title={`${hint}${metrics ? ` / Late ${metrics.late} min / Undertime ${metrics.earlyDeparture} min` : ""}`} disabled={locked} className={`relative flex h-9 w-full select-none items-center justify-center break-words px-0.5 text-[9px] font-semibold ${highlighted ? "bg-emerald-100 text-moss" : metrics?.late || metrics?.earlyDeparture ? "bg-amber-50 text-amber-800" : row ? styleFor(status || undefined, !input) : "bg-ink/5"} ${edit || highlighted ? "ring-1 ring-inset ring-moss" : ""}`} style={{ touchAction: "none" }} onPointerDown={(e) => start(e, r, c)} onPointerMove={drag} onPointerUp={finish} onPointerCancel={() => { gesture.current = null; setRange(null); }} onContextMenu={(e) => { if (row && !locked) { e.preventDefault(); setMenu({ row, x: Math.max(4, Math.min(e.clientX, window.innerWidth - 190)), y: Math.max(4, Math.min(e.clientY, window.innerHeight - 260)) }); } }} onClick={(e) => { if (e.detail === 0 && row && !locked) { if (brush === "late") setDetail([row]); else { remember(); paint(r, c, editsRef.current); } } }}>
        {row?.attendance?.payroll_posted_at ? <LockKeyhole className="absolute right-0.5 top-0.5 h-2.5 w-2.5 text-ink/35" /> : null}{label}{!row?.terms && row ? <span className="text-red-700">!</span> : null}
      </button></td>;
    })}{[summary.absent, summary.restDay, summary.leave, summary.awol, summary.presentDays.toFixed(2), summary.late, summary.undertime].map((value, i) => <td key={i} className="border-b border-r border-line bg-[#fafcfb] px-1 py-2 font-mono font-semibold">{value}</td>)}</tr>; })}{!employees.length ? <tr><td colSpan={dates.length + 8} className="p-10 text-left text-ink/45">{query.isFetching ? "Loading cutoff matrix..." : "No dated employee assignments match this cutoff"}</td></tr> : null}</tbody></table></div>
    <PaginationControls page={page} pageSize={size} total={query.data?.total || 0} onPageChange={(next) => leave(() => setPage(next))} onPageSizeChange={(next) => leave(() => { setSize(next); setPage(1); })} />
    {menu ? <div ref={menuRef} role="menu" aria-label="Attendance quick transactions" className="fixed z-[70] w-44 rounded border border-line bg-white p-1 shadow-lg" style={{ left: menu.x, top: menu.y }}>{brushes.map(({ id, label, icon: Icon }) => <button type="button" role="menuitem" key={id} className="flex h-9 w-full items-center gap-2 rounded px-2 text-left text-xs hover:bg-paper focus:bg-paper" onClick={() => quick(menu.row, id)}><Icon className="h-3.5 w-3.5" />{label}</button>)}</div> : null}
    {detail ? <AttendanceTimeAdjustment row={detail[0]} rows={detail} initial={detail.length === 1 ? edits[matrixKey(detail[0].employeeId, detail[0].date)] : undefined} onClose={() => setDetail(null)} onApply={(inputs) => { remember(); const next = { ...editsRef.current }; inputs.forEach((input) => { next[matrixKey(input.employee_id, input.work_date)] = input; }); editsRef.current = next; setEdits(next); setDetail(null); }} /> : null}
  </div>;
}
