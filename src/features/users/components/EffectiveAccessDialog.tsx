import { CheckCircle2, ShieldCheck, X, XCircle } from "lucide-react";
import type { AccessRole } from "../../../services/access/accessControl";
import { accessProfileForUser, rolesForUser } from "../../../services/access/userAccessModel";
import type { SystemUser } from "../../../types/systemUser";
import { branches, clients } from "../../../services/lookups/organization";
import { PermissionMatrix } from "./PermissionMatrix";

export function EffectiveAccessDialog({ user, roles, users = [], employees = [], onClose }: { user: SystemUser; roles: AccessRole[]; users?: SystemUser[]; employees?: Array<{ id: string; label: string }>; onClose: () => void }) {
  const assigned = rolesForUser(user, roles); const profile = accessProfileForUser(user, roles);
  const roleDerived = [...new Set(assigned.flatMap((role) => role.permissions))].sort();
  const scope = user.scope_type === "organization" ? "All organization records" : user.scope_type === "assigned_branches" ? user.branch_ids.map((id) => branches.find((item) => item.id === id)?.label ?? id).join(", ") : user.scope_type === "assigned_clients" ? user.client_ids.map((id) => clients.find((item) => item.id === id)?.label ?? id).join(", ") : "Linked employee only";
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/45 p-3"><section className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-md border border-line bg-white shadow-2xl">
    <header className="flex items-center justify-between border-b border-line px-5 py-3"><div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded bg-moss/10 text-moss"><ShieldCheck className="h-5 w-5" /></span><div><h2 className="font-semibold">Effective access: {user.display_name}</h2><p className="text-xs text-ink/55">The final result after roles, direct grants, and direct denies.</p></div></div><button onClick={onClose} className="icon-button" aria-label="Close"><X className="h-4 w-4" /></button></header>
    <div className="grid min-h-0 gap-4 overflow-y-auto p-5">
      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded border border-line p-3"><p className="text-[10px] font-bold uppercase text-ink/45">Roles</p><p className="mt-1 text-sm font-medium">{assigned.map((r) => r.name).join(", ") || "None"}</p></div>
        <div className="rounded border border-line p-3"><p className="text-[10px] font-bold uppercase text-ink/45">Scope</p><p className="mt-1 text-sm font-medium">{scope || "No assignment"}</p></div>
        <div className="rounded border border-emerald-200 bg-emerald-50 p-3"><p className="flex items-center gap-1 text-[10px] font-bold uppercase text-emerald-700"><CheckCircle2 className="h-3 w-3" /> Direct grants</p><p className="mt-1 text-sm font-medium">{user.direct_grants.length}</p></div>
        <div className="rounded border border-red-200 bg-red-50 p-3"><p className="flex items-center gap-1 text-[10px] font-bold uppercase text-red-700"><XCircle className="h-3 w-3" /> Direct denies</p><p className="mt-1 text-sm font-medium">{user.direct_denies.length}</p></div>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded border border-line p-3"><p className="text-[10px] font-bold uppercase text-ink/45">Role-derived permissions</p><p className="mt-1 break-words text-[11px] leading-5 text-ink/65">{roleDerived.join(", ") || "None"}</p></div>
        <div className="rounded border border-emerald-200 p-3"><p className="text-[10px] font-bold uppercase text-emerald-700">Direct grants</p><p className="mt-1 break-words text-[11px] leading-5 text-ink/65">{user.direct_grants.join(", ") || "None"}</p></div>
        <div className="rounded border border-red-200 p-3"><p className="text-[10px] font-bold uppercase text-red-700">Direct denies</p><p className="mt-1 break-words text-[11px] leading-5 text-ink/65">{user.direct_denies.join(", ") || "None"}</p></div>
      </div>
      <div className="rounded border border-line bg-[#fafcfb] px-3 py-2 text-xs text-ink/65"><strong className="text-ink">Assignments:</strong> {user.resource_assignments.join(", ") || "No additional resources"}<span className="mx-2 text-ink/25">|</span><strong className="text-ink">Linked employee:</strong> {employees.find((item) => item.id === user.linked_employee_id)?.label ?? "None"}<span className="mx-2 text-ink/25">|</span><strong className="text-ink">Manager:</strong> {users.find((item) => item.id === user.manager_user_id)?.display_name ?? "None"}</div>
      <div><p className="mb-2 text-xs font-semibold uppercase text-ink/50">Final permission matrix</p><PermissionMatrix value={profile.effectivePermissions ?? []} disabled compact /></div>
    </div>
  </section></div>;
}
