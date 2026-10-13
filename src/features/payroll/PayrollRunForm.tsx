import { useCallback, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Save, X } from "lucide-react";
import type { PayrollRepository } from "../../services/repositories/PayrollRepository";
import type { PayrollRunRepository } from "../../services/repositories/PayrollRunRepository";
import type { PayrollRunInput } from "../../types/payrollRun";
import { validateRunInput } from "../../services/payroll/payrollRuns";
import { useUnsavedChanges } from "../../components/forms/unsavedChanges";
import { useWorkspaceDialog } from "../../components/layout/WorkspaceNavigation";
import { showTransactionSuccess } from "../../services/activity/transactionNotifications";
import { PayrollLookup } from "./PayrollLookup";

export function PayrollRunForm({ repository, payroll, onClose, refresh }: { repository: PayrollRunRepository; payroll: PayrollRepository; onClose: () => void; refresh: () => Promise<void> }) {
  const [input, setInput] = useState<PayrollRunInput>({ title: "", worksite_id: "", worksite_label: "", payroll_group: "", frequency: "semi_monthly", period_start: "", period_end: "", pay_date: "", reason: "" });
  const mutation = useMutation({ mutationFn: async () => { validateRunInput(input); await repository.create(input); await refresh(); await showTransactionSuccess("Payroll run created", "The run is saved as a preparation draft. No salary or deduction has been calculated."); onClose(); } });
  const guard = useUnsavedChanges(Boolean(input.title || input.worksite_id || input.reason || input.period_start || input.payroll_group || input.period_end || input.pay_date), mutation.isPending);
  const close = () => { if (!mutation.isPending) guard.confirmDiscard(onClose); };
  useWorkspaceDialog("New Payroll Run", close);
  const loadSites = useCallback(async (search: string) => (await payroll.list({ kind: "worksite", search, limit: 20 })).items.map((r) => ({ id: r.id, label: r.data.label })), [payroll]);
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/45 p-3"><section role="dialog" aria-modal="true" aria-label="New payroll run" className="flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-md bg-white shadow-xl">
    <header className="flex items-center justify-between border-b border-line px-4 py-3"><h2 className="text-sm font-semibold">New payroll run</h2><button type="button" className="icon-button" title="Close" aria-label="Close new payroll run" onClick={close} disabled={mutation.isPending}><X className="h-4 w-4" /></button></header>
    <form className="flex min-h-0 flex-col" onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }}><div className="grid gap-3 overflow-y-auto p-4 sm:grid-cols-2">
      <label className="field-label sm:col-span-2">Run title<input className="compact-control mt-1 w-full" required maxLength={200} value={input.title} onChange={(e) => setInput({ ...input, title: e.target.value })} /></label>
      <PayrollLookup label="Run worksite" value={input.worksite_id} selectedLabel={input.worksite_label} required load={loadSites} onChange={(id, label) => setInput({ ...input, worksite_id: id, worksite_label: label })} />
      <label className="field-label">Payroll group<input className="compact-control mt-1 w-full" required maxLength={200} value={input.payroll_group} onChange={(e) => setInput({ ...input, payroll_group: e.target.value })} /></label>
      <label className="field-label">Frequency<select className="compact-control mt-1 w-full" value={input.frequency} onChange={(e) => setInput({ ...input, frequency: e.target.value as PayrollRunInput["frequency"] })}><option value="weekly">Weekly</option><option value="semi_monthly">Semi-monthly</option><option value="monthly">Monthly</option></select></label>
      {(["period_start", "period_end", "pay_date"] as const).map((key) => <label key={key} className="field-label">{{ period_start: "Period start", period_end: "Period end", pay_date: "Pay date" }[key]}<input className="compact-control mt-1 w-full" type="date" required value={input[key]} onInput={(e) => { const value = e.currentTarget.value; setInput((r) => ({ ...r, [key]: value })); }} onChange={(e) => { const value = e.target.value; setInput((r) => ({ ...r, [key]: value })); }} /></label>)}
      <label className="field-label sm:col-span-2">Preparation reference<textarea className="compact-control mt-1 w-full" required rows={2} maxLength={1000} value={input.reason} onChange={(e) => setInput({ ...input, reason: e.target.value })} /></label>
      {mutation.isError ? <p role="alert" className="text-xs text-red-700 sm:col-span-2">{mutation.error.message}</p> : null}
    </div><footer className="flex justify-end gap-2 border-t border-line px-4 py-3"><button type="button" className="secondary-button" disabled={mutation.isPending} onClick={close}>Cancel</button><button className="primary-button" disabled={mutation.isPending}><Save className="h-4 w-4" />{mutation.isPending ? "Saving..." : "Create draft"}</button></footer></form>
  </section></div>;
}
