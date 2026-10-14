import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Save, X } from "lucide-react";
import { useAccess } from "../../services/access/useAccess";
import { useOrganization } from "../../services/organization/useOrganization";
import { placementOptions } from "../../services/access/placementOptions";
import { AttendanceReviewService } from "../../services/payroll/AttendanceReviewService";
import type { AttendanceReviewPolicy } from "../../services/payroll/attendanceReview";
import { SearchableSelect } from "../../components/ui/SearchableSelect";
import { useUnsavedChanges } from "../../components/forms/unsavedChanges";
import { useWorkspaceDialog } from "../../components/layout/WorkspaceNavigation";
export function AttendanceReviewSettings({ service, onClose }: { service: AttendanceReviewService; onClose: () => void }) {
  const { profile } = useAccess(), directory = useOrganization(), client = useQueryClient();
  const scoped = placementOptions(profile, directory.branches, directory.clients);
  const [branch, setBranch] = useState(""), [siteClient, setSiteClient] = useState(""), [draft, setDraft] = useState<AttendanceReviewPolicy | null>(null);
  const policies = useQuery({ queryKey: ["attendance-review-policies", profile.userId], queryFn: () => service.policies() });
  const users = useQuery({ queryKey: ["attendance-review-approvers", profile.userId, branch, siteClient], queryFn: () => service.approvers(branch, siteClient || null), enabled: Boolean(branch) });
  const current = draft || policies.data?.find((p) => p.branch_id === branch && p.client_id === (siteClient || null)) || { branch_id: branch, client_id: siteClient || null, mode: "manual" as const, approver_ids: [] };
  const mutation = useMutation({ mutationFn: async () => { await service.savePolicy({ ...current, branch_id: branch, client_id: siteClient || null }); setDraft(null); for (const key of ["attendance-review-policies", "attendance-review", "attendance-matrix", "payroll-run-coverage"]) await client.invalidateQueries({ queryKey: [key] }); } });
  const guard = useUnsavedChanges(Boolean(draft), mutation.isPending), close = () => guard.confirmDiscard(onClose);
  useWorkspaceDialog("Attendance Review Settings", close);
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/45 p-3"><section role="dialog" aria-modal="true" aria-label="Attendance review settings" className="flex max-h-[92dvh] w-full max-w-xl flex-col overflow-hidden rounded-md bg-white shadow-xl">
    <header className="flex items-center justify-between border-b border-line px-4 py-3"><h2 className="text-sm font-semibold">Attendance review settings</h2><button type="button" className="icon-button" title="Close" aria-label="Close attendance review settings" disabled={mutation.isPending} onClick={close}><X className="h-4 w-4" /></button></header>
    <form className="flex min-h-0 flex-col" onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }}><fieldset disabled={mutation.isPending} className="grid min-h-0 gap-3 overflow-auto p-4 sm:grid-cols-2">
      <label className="field-label">Branch<SearchableSelect className="compact-control mt-1 w-full" required value={branch} onChange={(e) => { const value = e.target.value; guard.confirmDiscard(() => { setBranch(value); setSiteClient(""); setDraft(null); }); }}><option value="">Select branch</option>{scoped.branches.filter((b) => b.isActive).map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}</SearchableSelect></label>
      <label className="field-label">Client<SearchableSelect className="compact-control mt-1 w-full" disabled={!branch} value={siteClient} onChange={(e) => { const value = e.target.value; guard.confirmDiscard(() => { setSiteClient(value); setDraft(null); }); }}><option value="">Agency / direct employees</option>{scoped.clients.filter((c) => c.isActive && c.branchId === branch).map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</SearchableSelect></label>
      <label className="field-label sm:col-span-2">Review mode<select aria-label="Attendance review mode" className="compact-control mt-1 w-full" disabled={!branch || policies.isPending || policies.isError} value={current.mode} onChange={(e) => setDraft({ ...current, mode: e.target.value as AttendanceReviewPolicy["mode"] })}><option value="manual">Manual approval</option><option value="automatic">Automatic approval</option></select></label>
      <fieldset className="min-w-0 sm:col-span-2"><legend className="mb-2 text-xs font-semibold">Assigned approvers</legend><div className="max-h-56 space-y-2 overflow-auto">{users.data?.map((user) => <label key={user.id} className="flex items-center gap-2 text-xs"><input type="checkbox" checked={current.approver_ids.includes(user.id)} onChange={(e) => setDraft({ ...current, approver_ids: e.target.checked ? [...current.approver_ids, user.id] : current.approver_ids.filter((id) => id !== user.id) })} />{user.label}</label>)}</div></fieldset>
      {policies.isError || users.isError || mutation.isError ? <p role="alert" className="text-xs text-red-700 sm:col-span-2">{policies.error?.message || users.error?.message || mutation.error?.message}</p> : null}
    </fieldset><footer className="flex justify-end gap-2 border-t border-line px-4 py-3"><button type="button" className="secondary-button" disabled={mutation.isPending} onClick={close}>Close</button><button className="primary-button" disabled={!branch || policies.isPending || users.isPending || policies.isError || users.isError || mutation.isPending}><Save className="h-4 w-4" />Save policy</button></footer></form>
  </section></div>;
}
