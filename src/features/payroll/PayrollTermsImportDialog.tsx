import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Download, Save, X } from "lucide-react";
import { useAccess } from "../../services/access/useAccess";
import { createPayrollRepository } from "../../services/repositories/payrollRepositoryFactory";
import { createRepositories } from "../../services/repositories/repositoryFactory";
import { assertPayrollAccess } from "../../services/payroll/payrollAccess";
import { readSpreadsheet } from "../../services/imports/excelWorkbook";
import { downloadEmployeeTermsTemplate, prepareEmployeeTermsImport, type EmployeeTermsImportRow } from "../../services/payroll/employeeTermsImport";
import type { PayrollRecord } from "../../types/payroll";
import { useUnsavedChanges } from "../../components/forms/unsavedChanges";
import { useWorkspaceDialog } from "../../components/layout/WorkspaceNavigation";
import { PaginationControls } from "../../components/ui/PaginationControls";
import { formatPesos } from "../../services/payments/paymentMath";
import { showTransactionSuccess } from "../../services/activity/transactionNotifications";

export function PayrollTermsImportDialog({ onClose }: { onClose: () => void }) {
  const { profile } = useAccess(), client = useQueryClient();
  const repository = useMemo(() => createPayrollRepository(profile), [profile]);
  const [rows, setRows] = useState<EmployeeTermsImportRow[]>([]), [error, setError] = useState(""), [reading, setReading] = useState(false), [saved, setSaved] = useState(false);
  const [page, setPage] = useState(1), [size, setSize] = useState(25);
  const ready = rows.length > 0 && rows.every((r) => r.input && !r.error);
  async function sites() {
    const records: PayrollRecord[] = [];
    for (let offset = 0; ; offset += 100) { const result = await repository.list({ kind: "worksite", limit: 100, offset }); records.push(...result.items); if (offset + result.items.length >= result.total) return records; }
  }
  const mutation = useMutation({ mutationFn: async () => {
    assertPayrollAccess(profile, true);
    if (!ready) throw new Error("Correct all rows before importing.");
    await repository.saveBatch(rows.map((r) => r.input!)); setSaved(true);
    await client.invalidateQueries({ queryKey: ["payroll-setup"] }); await client.invalidateQueries({ queryKey: ["employee-payroll-template"] }); await client.invalidateQueries({ queryKey: ["payroll-work-date"] }); await client.invalidateQueries({ queryKey: ["attendance-team"] }); await client.invalidateQueries({ queryKey: ["payroll-run-coverage"] });
    await showTransactionSuccess("Employee payroll terms imported", `${rows.length} effective-dated versions saved.`);
  } });
  const guard = useUnsavedChanges(rows.length > 0 && !saved, reading || mutation.isPending);
  const close = () => { if (!reading && !mutation.isPending) guard.confirmDiscard(onClose); };
  useWorkspaceDialog("Import Employee Payroll Terms", close);
  async function read(file: File) {
    setReading(true); setRows([]); setError(""); setSaved(false); setPage(1); mutation.reset();
    try { assertPayrollAccess(profile, true); const parsed = await readSpreadsheet(file); const employees = createRepositories().employees; setRows(await prepareEmployeeTermsImport(parsed, (number) => employees.findByEmployeeNumber(number), (id, date) => repository.workDateRecords(id, date), await sites())); }
    catch (reason) { setError((reason as Error).message); } finally { setReading(false); }
  }
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/45 p-3"><section role="dialog" aria-modal="true" aria-label="Import employee payroll terms" className="flex max-h-[92dvh] w-full max-w-5xl flex-col overflow-hidden rounded-md bg-white shadow-xl">
    <header className="flex items-center justify-between border-b border-line px-4 py-3"><h2 className="text-sm font-semibold">Import employee payroll terms</h2><button type="button" className="icon-button" title="Close" aria-label="Close payroll terms import" disabled={reading || mutation.isPending} onClick={close}><X className="h-4 w-4" /></button></header>
    <div className="flex flex-wrap items-center gap-3 border-b border-line p-3"><input type="file" accept=".xlsx,.xlsm" aria-label="Employee payroll terms workbook" className="min-w-0 max-w-full text-xs" disabled={reading || mutation.isPending} onChange={(e) => { const file = e.target.files?.[0]; if (file) void read(file); e.target.value = ""; }} /><button type="button" className="icon-button" title="Download payroll terms template" aria-label="Download payroll terms template" disabled={reading || mutation.isPending} onClick={async () => { try { assertPayrollAccess(profile, true); await downloadEmployeeTermsTemplate(await sites()); } catch (reason) { setError((reason as Error).message); } }}><Download className="h-4 w-4" /></button><span role="status" className="text-xs text-ink/55">{reading ? "Validating employee terms..." : saved ? `${rows.length} saved` : `${rows.filter((r) => !r.error).length} ready / ${rows.filter((r) => r.error).length} need correction`}</span></div>
    {error || mutation.isError ? <p role="alert" className="bg-red-50 p-3 text-xs text-red-700">{error || mutation.error?.message}</p> : null}
    <div className="min-h-0 overflow-auto"><table className="w-full min-w-[760px] text-left text-xs"><thead className="sticky top-0 bg-[#f6f8f6]"><tr>{["Row", "Employee", "Effective date", "Worksite", "Rate / salary", "Validation"].map((h) => <th key={h} className="px-3 py-2 text-[10px] uppercase text-ink/50">{h}</th>)}</tr></thead><tbody className="divide-y divide-line">{rows.slice((page - 1) * size, page * size).map((r) => <tr key={r.rowNumber}><td className="px-3 py-2 font-mono">{r.rowNumber}</td><td className="px-3 py-2">{r.input?.data.employee_label || r.number}</td><td className="whitespace-nowrap px-3 py-2">{r.date}</td><td className="px-3 py-2">{r.input?.data.worksite_label || r.input?.data.worksite_id || "-"}</td><td className="px-3 py-2 font-mono">{r.input ? formatPesos(r.input.data.rate_centavos!) : "-"}</td><td className={`px-3 py-2 ${r.error ? "text-red-700" : "text-moss"}`}>{r.error || (saved ? "Saved" : "Ready")}</td></tr>)}{!rows.length ? <tr><td colSpan={6} className="px-3 py-10 text-center text-ink/45">No workbook selected</td></tr> : null}</tbody></table></div>
    <PaginationControls page={page} pageSize={size} total={rows.length} onPageChange={setPage} onPageSizeChange={(value) => { setSize(value); setPage(1); }} />
    <footer className="flex justify-end gap-2 border-t border-line px-4 py-3"><button className="secondary-button" disabled={reading || mutation.isPending} onClick={close}>Close</button><button className="primary-button" disabled={!ready || saved || reading || mutation.isPending} onClick={() => mutation.mutate()}><Save className="h-4 w-4" />{mutation.isPending ? "Saving..." : `Import ${rows.length} terms`}</button></footer>
  </section></div>;
}
