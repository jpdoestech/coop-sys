import { useState } from "react";
import { Pencil, Plus, ShieldCheck } from "lucide-react";
import { PageHeader } from "../../components/ui/PageHeader";
import { roleLabel } from "../../services/access/accessControl";
import { branches } from "../../services/lookups/organization";
import type { SystemUser, SystemUserInput } from "../../types/systemUser";
import { UserAccessForm } from "./components/UserAccessForm";
import { useUsers } from "./hooks/useUsers";
import { useAuth } from "../../services/auth/useAuth";

function scopeLabel(user: SystemUser) {
  if (!user.branch_ids.length) return "All offices and branches";
  return user.branch_ids.map((id) => branches.find((branch) => branch.id === id)?.label ?? "Unknown branch").join(", ");
}

export function UsersPage() {
  const { query, saveUser } = useUsers();
  const [editing, setEditing] = useState<SystemUser | null>(null);
  const [open, setOpen] = useState(false);
  const { session } = useAuth();
  function save(input: SystemUserInput) { saveUser.mutate({ user: editing, input }, { onSuccess: () => setOpen(false) }); }
  return <>
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><PageHeader eyebrow="Administration" title="System users" description="Assign operating roles and limit branch teams to the branches they are responsible for." /><button onClick={() => { saveUser.reset(); setEditing(null); setOpen(true); }} className="primary-button mb-3"><Plus className="h-4 w-4" /> Add user</button></div>
    <section className="overflow-hidden rounded-md border border-line bg-white shadow-panel">
      <div className="flex items-center gap-3 px-5 py-4"><ShieldCheck className="h-5 w-5 text-moss" /><div><p className="text-sm font-semibold">Role and branch assignments</p><p className="text-xs text-ink/55">Only Super Admin can maintain this list.</p></div></div>
      <div className="overflow-x-auto border-t border-line"><table className="w-full min-w-[820px] text-left text-sm"><thead><tr className="border-b border-line bg-[#f8faf8] text-[11px] uppercase text-ink/45"><th className="px-5 py-3">User</th><th className="px-4 py-3">Role</th><th className="px-4 py-3">Access scope</th><th className="px-4 py-3">Status</th><th className="w-16 px-4 py-3 text-right">Action</th></tr></thead><tbody className="divide-y divide-line">{query.data?.map((user) => <tr key={user.id} className="hover:bg-[#f8faf8]"><td className="px-5 py-3.5"><p className="font-semibold">{user.display_name}</p><p className="text-xs text-ink/55">{user.email}</p></td><td className="px-4 py-3.5">{roleLabel(user.role)}</td><td className="px-4 py-3.5 text-ink/70">{scopeLabel(user)}</td><td className="px-4 py-3.5">{user.is_active ? <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />Active</span> : <span className="rounded-full bg-paper px-2 py-1 text-xs text-ink/50">Inactive</span>}</td><td className="px-4 py-3.5 text-right"><button onClick={() => { saveUser.reset(); setEditing(user); setOpen(true); }} className="icon-button" title="Edit user" aria-label={`Edit ${user.display_name}`}><Pencil className="h-4 w-4" /></button></td></tr>)}</tbody></table>{query.isLoading ? <p className="px-5 py-10 text-center text-sm text-ink/55">Loading system users...</p> : null}</div>
    </section>
    {open ? <UserAccessForm user={editing} offline={session?.mode === "offline"} saving={saveUser.isPending} error={saveUser.error?.message} onCancel={() => setOpen(false)} onSubmit={save} /> : null}
  </>;
}
