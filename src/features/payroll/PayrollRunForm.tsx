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
import { useAccess } from "../../services/access/useAccess";
import { useOrganization } from "../../services/organization/useOrganization";
import { placementOptions } from "../../services/access/placementOptions";
import { SearchableSelect } from "../../components/ui/SearchableSelect";

export function PayrollRunForm({ repository, payroll, onClose, refresh }: { repository: PayrollRunRepository; payroll: PayrollRepository; onClose: () => void; refresh: () => Promise<void> }) {
  const { profile } = useAccess(), organization = useOrganization();
  const scoped = placementOptions(profile, organization.branches, organization.clients);
  const [placement, setPlacement] = useState({ branch: "", client: "" });
  const [input, setInput] = useState<PayrollRunInput>({ title: "", worksite_id: "", worksite_label: "", payroll_group: "", frequency: "semi_monthly", period_start: "", period_end: "", pay_date: "", reason: "" });
  const mutation = useMutation({ mutationFn: async () => { validateRunInput(input); await repository.create(input); await refresh(); await showTransactionSuccess("Payroll run created", "The run is saved as a preparation draft. No salary or deduction has been calculated."); onClose(); } });
  const guard = useUnsavedChanges(Boolean(input.title || input.worksite_id || input.reason || input.period_start || input.payroll_group || input.period_end || input.pay_date), mutation.isPending);
  const close = () => { if (!mutation.isPending) guard.confirmDiscard(onClose); };
  useWorkspaceDialog("New Payroll Run", close);
  const loadSites = useCallback(async (search: string) => (await payroll.list({ kind: "worksite", search, branchId: placement.branch || undefined, clientId: placement.branch ? placement.client || null : undefined, limit: 20 })).items.map((r) => ({ id: r.id, label: r.data.label })), [payroll, placement]);
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/45 p-3"><section role="dialog" aria-modal="true" aria-label="New payroll run" className="flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-md bg-white shadow-xl">
    <header className="flex items-center justify-between border-b border-line px-4 py-3"><h2 className="text-sm font-semibold">New payroll run</h2><button type="button" className="icon-button" title="Close" aria-label="Close new payroll run" onClick={close} disabled={mutation.isPending}><X className="h-4 w-4" /></button></header>
    <form className="flex min-h-0 flex-col" onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }}><div className="grid gap-3 overflow-y-auto p-4 sm:grid-cols-2">
      <label className="field-label sm:col-span-2">Run title<input className="compact-control mt-1 w-full" required maxLength={200} value={input.title} onChange={(e) => setInput({ ...input, title: e.target.value })} /></label>
      <label className="field-label">Branch<SearchableSelect className="compact-control mt-1 w-full" required value={placement.branch} onChange={(e) => { setPlacement({ branch: e.target.value, client: "" }); setInput((r) => ({ ...r, worksite_id: "", worksite_label: "" })); }}><option value="">Select branch</option>{scoped.branches.filter((b) => b.isActive).map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}</SearchableSelect></label>
      <label className="field-label">Client<SearchableSelect className="compact-control mt-1 w-full" disabled={!placement.branch} value={placement.client} onChange={(e) => { setPlacement((p) => ({ ...p, client: e.target.value })); setInput((r) => ({ ...r, worksite_id: "", worksite_label: "" })); }}><option value="">Agency / direct employees</option>{scoped.clients.filter((c) => c.isActive && c.branchId === placement.branch).map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</SearchableSelect></label>
      <PayrollLookup label="Run worksite" scopeKey={`${placement.branch}:${placement.client}`} disabled={!placement.branch} value={input.worksite_id} selectedLabel={input.worksite_label} required load={loadSites} onChange={(id, label) => setInput({ ...input, worksite_id: id, worksite_label: label })} />
      <label className="field-label">Payroll group<input className="compact-control mt-1 w-full" required maxLength={200} value={input.payroll_group} onChange={(e) => setInput({ ...input, payroll_group: e.target.value })} /></label>
      <label className="field-label">Frequency<select className="compact-control mt-1 w-full" value={input.frequency} onChange={(e) => setInput({ ...input, frequency: e.target.value as PayrollRunInput["frequency"] })}><option value="weekly">Weekly</option><option value="semi_monthly">Semi-monthly</option><option value="monthly">Monthly</option></select></label>
      {(["period_start", "period_end", "pay_date"] as const).map((key) => <label key={key} className="field-label">{{ period_start: "Cutoff start", period_end: "Cutoff end", pay_date: "Payout date" }[key]}<input className="compact-control mt-1 w-full" type="date" required min={key === "period_end" ? input.period_start || undefined : key === "pay_date" ? input.period_end || undefined : undefined} value={input[key]} onInput={(e) => { const value = e.currentTarget.value; setInput((r) => ({ ...r, [key]: value })); }} onChange={(e) => { const value = e.target.value; setInput((r) => ({ ...r, [key]: value })); }} /></label>)}
      <label className="field-label sm:col-span-2">Preparation reference<textarea className="compact-control mt-1 w-full" required rows={2} maxLength={1000} value={input.reason} onChange={(e) => setInput({ ...input, reason: e.target.value })} /></label>
      {mutation.isError ? <p role="alert" className="text-xs text-red-700 sm:col-span-2">{mutation.error.message}</p> : null}
    </div><footer className="flex justify-end gap-2 border-t border-line px-4 py-3"><button type="button" className="secondary-button" disabled={mutation.isPending} onClick={close}>Cancel</button><button className="primary-button" disabled={mutation.isPending}><Save className="h-4 w-4" />{mutation.isPending ? "Saving..." : "Create draft"}</button></footer></form>
  </section></div>;
}
