import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Download, Save, X } from "lucide-react";
import { useWorkspaceDialog } from "../../components/layout/WorkspaceNavigation";
import { useUnsavedChanges } from "../../components/forms/unsavedChanges";
import { PaginationControls } from "../../components/ui/PaginationControls";
import { createRepositories } from "../../services/repositories/repositoryFactory";
import type { AttendanceRepository } from "../../services/repositories/AttendanceRepository";
import type { PayrollRepository } from "../../services/repositories/PayrollRepository";
import { readSpreadsheet } from "../../services/imports/excelWorkbook";
import { downloadAttendanceTemplate, prepareAttendanceImport, type AttendanceImportResult } from "../../services/payroll/attendanceImport";
import { attendanceInputsOverlap, attendanceMinutes } from "../../services/payroll/attendanceCore";
import { showTransactionSuccess } from "../../services/activity/transactionNotifications";

export function AttendanceImportDialog({ repository, payroll, onClose, refresh }: { repository: AttendanceRepository; payroll: PayrollRepository; onClose: () => void; refresh: () => Promise<void> }) {
  const [rows, setRows] = useState<AttendanceImportResult[]>([]), [error, setError] = useState(""), [reading, setReading] = useState(false), [saved, setSaved] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 }), [page, setPage] = useState(1), [size, setSize] = useState(25);
  const inputs = rows.flatMap((row) => row.input && !row.error ? [row.input] : []);
  const mutation = useMutation({ mutationFn: async () => { await repository.saveBatch(inputs); setSaved(true); await refresh(); await showTransactionSuccess("Attendance imported", `${inputs.length} daily records saved as drafts. ${rows.length - inputs.length} records were not imported.`); } });
  const guard = useUnsavedChanges(rows.length > 0 && !saved, reading || mutation.isPending);
  const close = () => { if (!reading && !mutation.isPending) guard.confirmDiscard(onClose); };
  useWorkspaceDialog("Import Attendance", close);
  async function read(file: File) {
    setReading(true); setRows([]); setSaved(false); setError(""); setPage(1); setProgress({ done: 0, total: 0 });
    try {
      const parsed = await readSpreadsheet(file), employees = createRepositories().employees;
      setRows(await prepareAttendanceImport(parsed, file.name, (number) => employees.findByEmployeeNumber(number), (id, date) => payroll.workDateRecords(id, date), async (id, date, input) => {
        const adjacentDate = (offset: number) => new Date(Date.parse(`${date}T00:00:00Z`) + offset * 86400000).toISOString().slice(0, 10);
        const existing = (await repository.list({ employeeId: id, dateFrom: adjacentDate(-1), dateTo: adjacentDate(1), limit: 3 })).items;
        if (existing.some((record) => record.work_date === date)) return true;
        if (existing.some((record) => attendanceInputsOverlap(input, record))) throw new Error("Punches overlap an existing adjacent work date.");
        return false;
      }, (done, total) => setProgress({ done, total })));
    } catch (reason) { setError((reason as Error).message); } finally { setReading(false); }
  }
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/45 p-3"><section role="dialog" aria-modal="true" aria-label="Import daily attendance" className="flex max-h-[92dvh] w-full max-w-5xl flex-col overflow-hidden rounded-md bg-white shadow-xl"><header className="flex items-center justify-between border-b border-line px-4 py-3"><h2 className="text-sm font-semibold">Import daily attendance</h2><button type="button" className="icon-button" title="Close" aria-label="Close attendance import" disabled={reading || mutation.isPending} onClick={close}><X className="h-4 w-4" /></button></header>
    <div className="flex flex-wrap items-center gap-3 border-b border-line p-3"><input aria-label="Attendance Excel file" className="min-w-0 max-w-full text-xs" type="file" accept=".xlsx,.xlsm" disabled={reading || mutation.isPending} onChange={(e) => { const file = e.target.files?.[0]; if (file) void read(file); e.target.value = ""; }} /><button type="button" className="icon-button" title="Download attendance template" aria-label="Download attendance template" onClick={() => void downloadAttendanceTemplate().catch((reason) => setError((reason as Error).message))}><Download className="h-4 w-4" /></button><p role="status" className="text-xs text-ink/55">{reading ? `Checking ${progress.done} / ${progress.total || "..."}` : saved ? `${inputs.length} records saved` : `${inputs.length} ready / ${rows.length - inputs.length} need correction`}</p></div>
    {error || mutation.isError ? <p role="alert" className="bg-red-50 p-3 text-xs text-red-700">{error || mutation.error?.message}</p> : null}
    <div className="min-h-0 overflow-auto"><table className="w-full min-w-[760px] text-left text-xs"><thead className="sticky top-0 bg-[#f6f8f6]"><tr>{["Rows", "Employee", "Work date", "Status", "Worked minutes", "Validation"].map((h) => <th key={h} className="border-b border-line px-3 py-2 text-[10px] uppercase text-ink/50">{h}</th>)}</tr></thead><tbody className="divide-y divide-line">{rows.slice((page - 1) * size, page * size).map((row, index) => <tr key={index}><td className="px-3 py-2 font-mono">{row.rowNumbers.join(", ")}</td><td className="px-3 py-2">{row.input?.employee_label || row.employeeNumber}</td><td className="whitespace-nowrap px-3 py-2 font-mono">{row.date}</td><td className="px-3 py-2">{row.input?.status || "-"}</td><td className="px-3 py-2 font-mono">{row.input ? attendanceMinutes(row.input) : "-"}</td><td className={`max-w-80 px-3 py-2 ${row.error ? "text-red-700" : "text-moss"}`}>{row.error || (saved ? "Saved as draft" : "Ready")}</td></tr>)}{!rows.length ? <tr><td colSpan={6} className="px-3 py-10 text-center text-ink/45">{reading ? "Validating attendance..." : "No workbook selected"}</td></tr> : null}</tbody></table></div>
    <PaginationControls page={page} pageSize={size} total={rows.length} onPageChange={setPage} onPageSizeChange={(value) => { setSize(value); setPage(1); }} />
    <footer className="flex justify-end gap-2 border-t border-line px-4 py-3"><button type="button" className="secondary-button" disabled={reading || mutation.isPending} onClick={close}>Close</button><button type="button" className="primary-button" disabled={reading || mutation.isPending || !inputs.length || saved} onClick={() => mutation.mutate()}><Save className="h-4 w-4" />{mutation.isPending ? "Saving..." : "Save valid records"}</button></footer>
  </section></div>;
}
