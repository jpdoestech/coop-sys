import { useCallback, useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Plus, Save, Trash2, X } from "lucide-react";
import { useWorkspaceDialog } from "../../components/layout/WorkspaceNavigation";
import { useUnsavedChanges } from "../../components/forms/unsavedChanges";
import { SearchableSelect } from "../../components/ui/SearchableSelect";
import { createRepositories } from "../../services/repositories/repositoryFactory";
import type { AttendanceRepository } from "../../services/repositories/AttendanceRepository";
import type { PayrollRepository } from "../../services/repositories/PayrollRepository";
import type { AttendanceRecord, AttendanceSegment, AttendanceStatus } from "../../types/attendance";
import { attendanceDate, attendanceMetrics, attendanceStatuses, validateAttendanceInput } from "../../services/payroll/attendanceCore";
import { resolvePayrollWorkDate } from "../../services/payroll/payrollSetup";
import { showTransactionSuccess } from "../../services/activity/transactionNotifications";
import { PayrollLookup } from "./PayrollLookup";

export function AttendanceForm({ repository, payroll, source, onClose, refresh }: { repository: AttendanceRepository; payroll: PayrollRepository; source?: AttendanceRecord; onClose: () => void; refresh: () => Promise<void> }) {
  const [employee, setEmployee] = useState({ id: source?.employee_id || "", label: source?.employee_label || "" });
  const [date, setDate] = useState(source?.work_date || new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()));
  const [status, setStatus] = useState<AttendanceStatus>(source?.status || "present"), [segments, setSegments] = useState<AttendanceSegment[]>(source ? structuredClone(source.segments) : []);
  const [reason, setReason] = useState(""), [error, setError] = useState("");
  const query = useQuery({ queryKey: ["attendance-terms", employee.id, date], queryFn: () => payroll.workDateRecords(employee.id, date), enabled: Boolean(employee.id) && attendanceDate(date), refetchOnWindowFocus: false });
  const result = query.data ? resolvePayrollWorkDate(query.data, employee.id, date) : null;
  const terms = result?.terms;
  useEffect(() => {
    if (!source && terms && status === "present") setSegments([{ time_in: terms.data.shift_start!, time_out: terms.data.shift_end!, in_next_day: false, out_next_day: terms.data.shift_end! <= terms.data.shift_start!, break_minutes: terms.data.break_minutes! }]);
  }, [source, terms, status]);
  const save = useMutation({ mutationFn: async () => {
    const input = { employee_id: employee.id, employee_label: employee.label, work_date: date, status, segments, reason, terms_id: terms?.id || "", replace_id: source?.id || null };
    validateAttendanceInput(input); await repository.saveBatch([input]); await refresh();
    await showTransactionSuccess("Attendance saved", "The attendance record is saved as a draft for review."); onClose();
  } });
  const guard = useUnsavedChanges(Boolean(employee.id || reason), save.isPending);
  const close = () => { if (!save.isPending) guard.confirmDiscard(onClose); };
  useWorkspaceDialog(source ? "Correct Attendance" : "Daily Attendance", close);
  const load = useCallback(async (search: string) => (await createRepositories().employees.listPage({ search, limit: 20 })).items.map((e) => ({ id: e.id, label: `${e.employee_number} - ${e.last_name}, ${e.first_name}` })), []);
  function update(index: number, values: Partial<AttendanceSegment>) { setSegments((all) => all.map((s, i) => i === index ? { ...s, ...values } : s)); }
  const metrics = terms ? attendanceMetrics({ segments, status }, terms.data) : null;
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/45 p-3"><section role="dialog" aria-modal="true" aria-label="Daily attendance" className="flex max-h-[92dvh] w-full max-w-3xl flex-col overflow-hidden rounded-md bg-white shadow-xl"><header className="flex items-center justify-between border-b border-line px-4 py-3"><h2 className="text-sm font-semibold">{source ? "Correct draft attendance" : "Daily attendance"}</h2><button type="button" className="icon-button" title="Close" aria-label="Close attendance form" disabled={save.isPending} onClick={close}><X className="h-4 w-4" /></button></header><form className="flex min-h-0 flex-col" onSubmit={(e) => { e.preventDefault(); setError(""); save.mutate(); }}><div className="space-y-3 overflow-y-auto p-4">
    <div className="grid gap-3 sm:grid-cols-2">{source ? <p className="text-xs font-semibold">{employee.label}</p> : <PayrollLookup label="Employee" value={employee.id} selectedLabel={employee.label} load={load} required onChange={(id, label) => setEmployee({ id, label })} />}
      <label className="field-label">Work date<input className="compact-control mt-1 w-full" type="date" required disabled={Boolean(source)} value={date} onInput={(e) => setDate(e.currentTarget.value)} onChange={(e) => setDate(e.target.value)} /></label>
      <label className="field-label">Attendance status<SearchableSelect className="compact-control mt-1 w-full" value={status} onChange={(e) => { const next = e.target.value as AttendanceStatus; setStatus(next); if (next !== "present") setSegments([]); }}>{attendanceStatuses.map((s) => <option key={s} value={s}>{s.replaceAll("_", " ")}</option>)}</SearchableSelect></label>
      <div className="text-xs"><p className="text-[10px] uppercase text-ink/45">Applicable duty</p><p className="mt-1 font-semibold">{query.isFetching ? "Loading..." : terms?.data.label || "No applicable pay terms"}</p><p className="mt-1 text-ink/55">{terms?.data.worksite_label || ""}</p></div>
    </div>
    {status === "present" ? <fieldset className="border-y border-line py-3"><legend className="text-xs font-semibold">Work segments</legend>{segments.map((segment, index) => <div key={index} className="mb-3 grid grid-cols-2 items-end gap-2 sm:grid-cols-[1fr_1fr_100px_32px]">
      <label className="field-label">Time in<input className="compact-control mt-1 w-full" type="time" required value={segment.time_in} onInput={(e) => update(index, { time_in: e.currentTarget.value })} onChange={(e) => update(index, { time_in: e.target.value })} /><span className="mt-1 flex items-center gap-1 text-[11px] font-normal"><input type="checkbox" checked={segment.in_next_day} onChange={(e) => update(index, { in_next_day: e.target.checked })} />Following day</span></label>
      <label className="field-label">Time out<input className="compact-control mt-1 w-full" type="time" required value={segment.time_out} onInput={(e) => update(index, { time_out: e.currentTarget.value })} onChange={(e) => update(index, { time_out: e.target.value })} /><span className="mt-1 flex items-center gap-1 text-[11px] font-normal"><input type="checkbox" checked={segment.out_next_day} onChange={(e) => update(index, { out_next_day: e.target.checked })} />Following day</span></label>
      <label className="field-label">Break minutes<input className="compact-control mt-1 w-full" type="number" min="0" step="1" required value={segment.break_minutes} onChange={(e) => update(index, { break_minutes: Number(e.target.value) })} /></label>
      <button type="button" className="icon-button" title="Remove segment" aria-label={`Remove segment ${index + 1}`} onClick={() => setSegments((all) => all.filter((_, i) => i !== index))}><Trash2 className="h-3.5 w-3.5" /></button></div>)}<button type="button" className="secondary-button" disabled={segments.length >= 12 || !terms} onClick={() => setSegments((all) => [...all, { time_in: "", time_out: "", in_next_day: false, out_next_day: false, break_minutes: 0 }])}><Plus className="h-3.5 w-3.5" />Segment</button></fieldset> : null}
    {metrics ? <dl className="grid grid-cols-3 gap-3 text-xs">{[["Worked minutes", metrics.worked], ["Late arrival", metrics.late], ["Early departure", metrics.earlyDeparture]].map(([label, value]) => <div key={label}><dt className="text-[10px] uppercase text-ink/45">{label}</dt><dd className="mt-1 font-mono">{Number.isFinite(value) ? value : "-"}</dd></div>)}</dl> : null}
    <label className="field-label block">Attendance / correction reference<textarea className="compact-control mt-1 w-full" rows={2} maxLength={1000} required value={reason} onChange={(e) => setReason(e.target.value)} /></label>
    {employee.id && !query.isFetching && !terms || query.isError || error || save.isError ? <p role="alert" className="text-xs text-red-700">{query.error?.message || error || save.error?.message || "Set up dated employee terms before saving attendance."}</p> : null}
  </div><footer className="flex justify-end gap-2 border-t border-line px-4 py-3"><button type="button" className="secondary-button" disabled={save.isPending} onClick={close}>Cancel</button><button className="primary-button" disabled={save.isPending || query.isFetching || !terms}><Save className="h-4 w-4" />{save.isPending ? "Saving..." : "Save draft"}</button></footer></form></section></div>;
}
