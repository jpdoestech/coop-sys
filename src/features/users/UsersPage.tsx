import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Copy, Eye, Pencil, Plus, Search, ShieldCheck, Trash2, UsersRound } from "lucide-react";
import { roleLabel, type AccessRole } from "../../services/access/accessControl";
import { rolesForUser } from "../../services/access/userAccessModel";
import { branches, clients } from "../../services/lookups/organization";
import { createRepositories } from "../../services/repositories/repositoryFactory";
import type { AccessRoleInput } from "../../services/repositories/UserAccessRepository";
import type { SystemUser, SystemUserInput } from "../../types/systemUser";
import { PaginationControls } from "../../components/ui/PaginationControls";
import { useAuth } from "../../services/auth/useAuth";
import { useAccess } from "../../services/access/useAccess";
import { createUserAccessRepository } from "../../services/repositories/userAccessRepositoryFactory";
import { EffectiveAccessDialog } from "./components/EffectiveAccessDialog";
import { PermissionMatrix } from "./components/PermissionMatrix";
import { RoleEditorDialog } from "./components/RoleEditorDialog";
import { UserAccessForm } from "./components/UserAccessForm";
import { useUsers } from "./hooks/useUsers";

type Tab = "users" | "roles" | "matrix";
function scopeLabel(user: SystemUser) {
  if (user.scope_type === "organization") return "Entire organization";
  if (user.scope_type === "self") return "Linked employee only";
  if (user.scope_type === "assigned_clients") return user.client_ids.map((id) => clients.find((item) => item.id === id)?.label ?? id).join(", ") || "No clients";
  return user.branch_ids.map((id) => branches.find((item) => item.id === id)?.label ?? id).join(", ") || "No branches";
}

export function UsersPage() {
  const [tab, setTab] = useState<Tab>("users"); const [page, setPage] = useState(1); const [pageSize, setPageSize] = useState(10); const [search, setSearch] = useState(""); const [status, setStatus] = useState<"active" | "inactive" | "all">("active");
  const deferredSearch = useDeferredValue(search);
  const { query, roles, saveUser, saveRole, deleteRole } = useUsers({ search: deferredSearch, status, limit: pageSize, offset: (page - 1) * pageSize });
  const [editingUser, setEditingUser] = useState<SystemUser | null>(null); const [userOpen, setUserOpen] = useState(false); const [effectiveUser, setEffectiveUser] = useState<SystemUser | null>(null);
  const [editingRole, setEditingRole] = useState<AccessRole | null>(null); const [roleOpen, setRoleOpen] = useState(false); const [cloning, setCloning] = useState(false); const [matrixRoleId, setMatrixRoleId] = useState("");
  const { session } = useAuth(); const { can } = useAccess(); const repositories = useMemo(() => createRepositories(), []);
  const employees = useQuery({ queryKey: ["access-employee-options"], queryFn: () => repositories.employees.list({ limit: 1000 }) });
  const allUsers = useQuery({ queryKey: ["system-users", "manager-options"], queryFn: async () => (await createUserAccessRepository().listPage({ status: "all", limit: 1000 })).items });
  useEffect(() => setPage(1), [deferredSearch, status, pageSize]);
  useEffect(() => { if (!matrixRoleId && roles.data?.length) setMatrixRoleId(roles.data[0].id); }, [roles.data, matrixRoleId]);
  const roleList = roles.data ?? []; const matrixRole = roleList.find((role) => role.id === matrixRoleId) ?? null;
  function submitUser(input: SystemUserInput) { saveUser.mutate({ user: editingUser, input }, { onSuccess: () => setUserOpen(false) }); }
  function submitRole(input: AccessRoleInput) { saveRole.mutate({ role: cloning ? null : editingRole, input }, { onSuccess: () => { setRoleOpen(false); setCloning(false); } }); }
  function openRole(role: AccessRole | null, clone = false) { saveRole.reset(); setEditingRole(role); setCloning(clone); setRoleOpen(true); }
  const employeeOptions = (employees.data ?? []).map((employee) => ({ id: employee.id, label: `${employee.employee_number} - ${employee.last_name}, ${employee.first_name}` }));
  return <>
    <div className="mb-3 flex flex-wrap items-center justify-between gap-3"><div><div className="flex items-center gap-2"><h1 className="text-xl font-semibold">Access Control</h1><span className="rounded bg-moss/10 px-2 py-1 text-[10px] font-bold uppercase text-moss">Administration</span></div><p className="text-xs text-ink/55">Users, roles, permissions, and scoped resource access.</p></div>{tab === "users" && can("users.create") ? <button onClick={() => { saveUser.reset(); setEditingUser(null); setUserOpen(true); }} className="primary-button"><Plus className="h-4 w-4" /> Add user</button> : tab === "roles" && can("roles.create") ? <button onClick={() => openRole(null)} className="primary-button"><Plus className="h-4 w-4" /> Create role</button> : null}</div>
    <section className="overflow-hidden rounded-md border border-line bg-white shadow-panel">
      <div className="flex items-center gap-1 border-b border-line px-3 pt-2">{([['users','Users',UsersRound],['roles','Roles',ShieldCheck],['matrix','Permission matrix',ShieldCheck]] as const).map(([id,label,Icon]) => <button key={id} onClick={() => setTab(id)} className={`flex items-center gap-2 border-b-2 px-3 py-2 text-xs font-semibold ${tab === id ? "border-moss text-moss" : "border-transparent text-ink/55 hover:text-ink"}`}><Icon className="h-3.5 w-3.5" />{label}</button>)}</div>
      {tab === "users" ? <>
        <div className="flex flex-wrap items-center gap-2 p-2"><div className="relative w-full sm:w-64"><Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink/35" /><input className="compact-control w-full pl-8" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or email" /></div><select className="compact-control w-full sm:w-36" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}><option value="active">Active users</option><option value="inactive">Inactive users</option><option value="all">All statuses</option></select><span className="ml-auto text-[11px] text-ink/45">{query.data?.total ?? 0} records</span></div>
        <div className="max-h-[64vh] overflow-auto border-t border-line"><table className="w-full min-w-[960px] text-left text-xs"><thead className="sticky top-0 z-10 bg-[#f8faf8] text-[10px] uppercase text-ink/45"><tr><th className="px-4 py-2.5">User</th><th className="px-3 py-2.5">Roles</th><th className="px-3 py-2.5">Scope</th><th className="px-3 py-2.5">Overrides</th><th className="px-3 py-2.5">Status</th><th className="w-24 px-3 py-2.5 text-right">Actions</th></tr></thead><tbody className="divide-y divide-line">{query.data?.items.map((user) => <tr key={user.id} className="hover:bg-[#f8faf8]"><td className="px-4 py-2.5"><p className="font-semibold">{user.display_name}</p><p className="text-[11px] text-ink/50">{user.email}</p></td><td className="px-3 py-2.5">{rolesForUser(user, roleList).map((role) => role.name).join(", ") || roleLabel(user.role)}</td><td className="max-w-64 truncate px-3 py-2.5 text-ink/65" title={scopeLabel(user)}>{scopeLabel(user)}</td><td className="px-3 py-2.5"><span className="text-emerald-700">+{user.direct_grants.length}</span><span className="ml-2 text-red-700">-{user.direct_denies.length}</span></td><td className="px-3 py-2.5"><span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium ${user.is_active ? "bg-emerald-50 text-emerald-700" : "bg-paper text-ink/50"}`}><span className={`h-1.5 w-1.5 rounded-full ${user.is_active ? "bg-emerald-500" : "bg-ink/30"}`} />{user.is_active ? "Active" : "Inactive"}</span></td><td className="px-3 py-2.5 text-right"><button onClick={() => setEffectiveUser(user)} className="icon-button" title="View effective access"><Eye className="h-3.5 w-3.5" /></button><button onClick={() => { saveUser.reset(); setEditingUser(user); setUserOpen(true); }} className="icon-button" title="Edit user"><Pencil className="h-3.5 w-3.5" /></button></td></tr>)}</tbody></table>{query.isLoading ? <p className="p-8 text-center text-sm text-ink/55">Loading users...</p> : null}</div>
        <PaginationControls page={page} pageSize={pageSize} total={query.data?.total ?? 0} onPageChange={setPage} onPageSizeChange={setPageSize} />
      </> : null}
      {tab === "roles" ? <div className="max-h-[70vh] overflow-auto"><table className="w-full min-w-[760px] text-left text-xs"><thead className="sticky top-0 bg-[#f8faf8] text-[10px] uppercase text-ink/45"><tr><th className="px-4 py-2.5">Role</th><th className="px-3 py-2.5">Code</th><th className="px-3 py-2.5">Permissions</th><th className="px-3 py-2.5">Status</th><th className="w-32 px-3 py-2.5 text-right">Actions</th></tr></thead><tbody className="divide-y divide-line">{roleList.map((role) => <tr key={role.id} className="hover:bg-[#f8faf8]"><td className="px-4 py-2.5"><p className="font-semibold">{role.name}</p><p className="text-[11px] text-ink/50">{role.description}</p></td><td className="px-3 py-2.5 font-mono text-[11px]">{role.code}</td><td className="px-3 py-2.5">{role.code === "super_admin" ? "All permissions" : `${role.permissions.length} permissions`}</td><td className="px-3 py-2.5">{role.is_active ? "Active" : "Inactive"}</td><td className="px-3 py-2.5 text-right"><button onClick={() => openRole(role, true)} className="icon-button" title="Clone role"><Copy className="h-3.5 w-3.5" /></button><button onClick={() => openRole(role)} className="icon-button" title="Edit role"><Pencil className="h-3.5 w-3.5" /></button>{!role.is_system ? <button onClick={() => { if (window.confirm(`Delete ${role.name}?`)) deleteRole.mutate(role.id); }} className="icon-button text-red-700" title="Delete role"><Trash2 className="h-3.5 w-3.5" /></button> : null}</td></tr>)}</tbody></table>{deleteRole.error ? <p className="p-3 text-sm text-red-700">{deleteRole.error.message}</p> : null}</div> : null}
      {tab === "matrix" ? <div className="p-3"><div className="mb-3 flex flex-wrap items-end gap-2"><label className="text-xs font-semibold">Role<select className="compact-control mt-1 block min-w-56" value={matrixRoleId} onChange={(e) => setMatrixRoleId(e.target.value)}>{roleList.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}</select></label>{matrixRole && !matrixRole.is_system ? <button className="secondary-button" onClick={() => openRole(matrixRole)}><Pencil className="h-4 w-4" /> Edit permissions</button> : null}<span className="text-xs text-ink/50">Only actions applicable to each module are shown.</span></div><PermissionMatrix value={matrixRole?.permissions ?? []} disabled compact /></div> : null}
    </section>
    {userOpen ? <UserAccessForm user={editingUser} roles={roleList} users={allUsers.data ?? []} employees={employeeOptions} offline={session?.mode === "offline"} saving={saveUser.isPending} error={saveUser.error?.message} onCancel={() => setUserOpen(false)} onSubmit={submitUser} /> : null}
    {roleOpen ? <RoleEditorDialog role={editingRole} clone={cloning} saving={saveRole.isPending} error={saveRole.error?.message} onCancel={() => setRoleOpen(false)} onSubmit={submitRole} /> : null}
    {effectiveUser ? <EffectiveAccessDialog user={effectiveUser} roles={roleList} users={allUsers.data ?? []} employees={employeeOptions} onClose={() => setEffectiveUser(null)} /> : null}
  </>;
}
