import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Check, Save, ShieldAlert, X } from "lucide-react";
import { permissionModules, type AccessRole, type Permission } from "../../../services/access/accessControl";
import { defaultRoleId, normalizeSystemUser } from "../../../services/access/userAccessModel";
import { branches, clients } from "../../../services/lookups/organization";
import type { SystemUser, SystemUserInput } from "../../../types/systemUser";
import { CHARACTER_LIMITS } from "../../../utils/inputSanitizers";

type SearchOption = { id: string; label: string };
type Props = { user: SystemUser | null; roles: AccessRole[]; users: SystemUser[]; employees: SearchOption[]; saving: boolean; error?: string; onCancel: () => void; onSubmit: (input: SystemUserInput) => void; offline: boolean };

const emptyUser: SystemUserInput = {
  display_name: "", email: "", role: "branch_user", role_ids: [defaultRoleId("branch_user")], branch_ids: [], client_ids: [], direct_grants: [], direct_denies: [], scope_type: "assigned_branches", resource_assignments: [], linked_employee_id: null, manager_user_id: null, is_active: true, temporary_password: "",
};

function SearchLink({ label, value, options, onChange, placeholder }: { label: string; value: string | null; options: SearchOption[]; onChange: (id: string | null) => void; placeholder: string }) {
  const selected = options.find((option) => option.id === value);
  const [text, setText] = useState(selected?.label ?? "");
  useEffect(() => setText(options.find((option) => option.id === value)?.label ?? ""), [value, options]);
  const listId = `lookup-${label.replace(/\W/g, "-").toLowerCase()}`;
  return <label className="text-xs font-semibold">{label}<input list={listId} className="compact-control mt-1 w-full" value={text} placeholder={placeholder} onChange={(event) => { const next = event.target.value; setText(next); onChange(options.find((option) => option.label === next)?.id ?? null); }} /><datalist id={listId}>{options.map((option) => <option key={option.id} value={option.label} />)}</datalist></label>;
}

export function UserAccessForm({ user, roles, users, employees, saving, error, onCancel, onSubmit, offline }: Props) {
  const [value, setValue] = useState<SystemUserInput>(emptyUser); const [validationError, setValidationError] = useState(""); const [section, setSection] = useState<"account" | "scope" | "overrides">("account");
  useEffect(() => { setValue(user ? { ...normalizeSystemUser(user), temporary_password: "" } : emptyUser); setValidationError(""); setSection("account"); }, [user]);
  const immutable = user?.role === "super_admin";
  const activeRoles = roles.filter((role) => role.is_active || value.role_ids.includes(role.id));
  const applicableClients = value.branch_ids.length ? clients.filter((client) => value.branch_ids.includes(client.branchId)) : clients;
  const managerOptions = useMemo(() => users.filter((item) => item.id !== user?.id).map((item) => ({ id: item.id, label: `${item.display_name} (${item.email})` })), [users, user]);
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!value.role_ids.length) return setValidationError("Assign at least one role.");
    if (value.scope_type === "assigned_branches" && !value.branch_ids.length) return setValidationError("Assign at least one branch.");
    if (value.scope_type === "assigned_clients" && !value.client_ids.length) return setValidationError("Assign at least one client.");
    if (value.scope_type === "self" && !value.linked_employee_id) return setValidationError("Link an employee for self-only access.");
    const primary = roles.find((role) => role.id === value.role_ids[0])?.code ?? value.role;
    onSubmit({ ...value, role: primary, email: value.email.trim().toLowerCase(), display_name: value.display_name.trim() });
  }
  function setOverride(permission: Permission, mode: "inherit" | "grant" | "deny") {
    setValue({ ...value, direct_grants: mode === "grant" ? [...value.direct_grants.filter((item) => item !== permission), permission] : value.direct_grants.filter((item) => item !== permission), direct_denies: mode === "deny" ? [...value.direct_denies.filter((item) => item !== permission), permission] : value.direct_denies.filter((item) => item !== permission) });
  }
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/45 p-3"><form onSubmit={submit} className="flex h-[min(760px,94vh)] w-full max-w-5xl flex-col overflow-hidden rounded-md border border-line bg-white shadow-2xl">
    <header className="flex items-center justify-between border-b border-line px-5 py-3"><div><p className="text-[10px] font-bold uppercase text-moss">Access control</p><h2 className="text-lg font-semibold">{user ? "Edit system user" : "Add system user"}</h2></div><button type="button" onClick={onCancel} className="icon-button" aria-label="Close"><X className="h-4 w-4" /></button></header>
    <nav className="flex gap-1 border-b border-line px-5 pt-2">{([['account','Account & roles'],['scope','Scope & assignments'],['overrides','Direct overrides']] as const).map(([id,label]) => <button type="button" key={id} onClick={() => setSection(id)} className={`border-b-2 px-3 py-2 text-xs font-semibold ${section === id ? "border-moss text-moss" : "border-transparent text-ink/55 hover:text-ink"}`}>{label}</button>)}</nav>
    <div className="min-h-0 flex-1 overflow-y-auto p-5">
      {immutable ? <div className="mb-4 flex items-center gap-2 rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800"><ShieldAlert className="h-4 w-4" /> Super Admin is unrestricted. Its roles and overrides are locked.</div> : null}
      {section === "account" ? <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-xs font-semibold">Display name<input required maxLength={CHARACTER_LIMITS.name} value={value.display_name} onChange={(e) => setValue({ ...value, display_name: e.target.value })} className="compact-control mt-1 w-full" /></label>
        <label className="text-xs font-semibold">Email address<input required readOnly={!offline && Boolean(user)} type="email" maxLength={254} value={value.email} onChange={(e) => setValue({ ...value, email: e.target.value })} className="compact-control mt-1 w-full read-only:bg-paper" /></label>
        {offline ? <label className="text-xs font-semibold sm:col-span-2">{user ? "Reset with temporary password" : "Temporary password"}<input required={!user} type="password" minLength={12} maxLength={128} value={value.temporary_password ?? ""} onChange={(e) => setValue({ ...value, temporary_password: e.target.value })} className="compact-control mt-1 w-full" /><span className="mt-1 block font-normal text-ink/50">{user ? "Leave blank to keep the current password." : "At least 12 characters; replacement is required at first sign-in."}</span></label> : null}
        <fieldset className="sm:col-span-2"><legend className="text-xs font-semibold">Assigned roles</legend><div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{activeRoles.map((role) => { const checked = value.role_ids.includes(role.id); return <label key={role.id} className={`flex items-start gap-2 rounded border px-3 py-2 text-xs ${checked ? "border-moss bg-moss/5" : "border-line"}`}><input disabled={immutable} type="checkbox" checked={checked} onChange={(e) => setValue({ ...value, role_ids: e.target.checked ? [...value.role_ids, role.id] : value.role_ids.filter((id) => id !== role.id) })} /><span><strong className="block">{role.name}</strong><span className="text-ink/50">{role.description}</span></span></label>; })}</div></fieldset>
        <label className="flex items-center gap-2 text-xs font-semibold sm:col-span-2"><input type="checkbox" disabled={immutable} checked={value.is_active} onChange={(e) => setValue({ ...value, is_active: e.target.checked })} /> Active system access</label>
      </div> : null}
      {section === "scope" ? <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-xs font-semibold">Data scope<select disabled={immutable} className="compact-control mt-1 w-full" value={value.scope_type} onChange={(e) => setValue({ ...value, scope_type: e.target.value as SystemUserInput['scope_type'] })}><option value="organization">Entire organization</option><option value="assigned_branches">Assigned branches</option><option value="assigned_clients">Assigned clients</option><option value="self">Linked employee only</option></select></label>
        <SearchLink label="Manager" value={value.manager_user_id} options={managerOptions} onChange={(manager_user_id) => setValue({ ...value, manager_user_id })} placeholder="Type a manager name" />
        {(value.scope_type === "assigned_branches" || value.scope_type === "assigned_clients") ? <fieldset className="sm:col-span-2"><legend className="text-xs font-semibold">Branches</legend><div className="mt-2 grid gap-2 sm:grid-cols-3">{branches.map((branch) => <label key={branch.id} className="flex items-center gap-2 rounded border border-line px-3 py-2 text-xs"><input type="checkbox" checked={value.branch_ids.includes(branch.id)} onChange={(e) => setValue({ ...value, branch_ids: e.target.checked ? [...value.branch_ids, branch.id] : value.branch_ids.filter((id) => id !== branch.id), client_ids: value.client_ids.filter((id) => clients.some((client) => client.id === id && (e.target.checked || client.branchId !== branch.id))) })} />{branch.label}</label>)}</div></fieldset> : null}
        {value.scope_type === "assigned_clients" ? <fieldset className="sm:col-span-2"><legend className="text-xs font-semibold">Clients</legend><div className="mt-2 grid gap-2 sm:grid-cols-2">{applicableClients.map((client) => <label key={client.id} className="flex items-center gap-2 rounded border border-line px-3 py-2 text-xs"><input type="checkbox" checked={value.client_ids.includes(client.id)} onChange={(e) => setValue({ ...value, client_ids: e.target.checked ? [...value.client_ids, client.id] : value.client_ids.filter((id) => id !== client.id) })} />{client.label}</label>)}</div></fieldset> : null}
        {(value.scope_type === "self" || value.linked_employee_id) ? <SearchLink label="Linked employee" value={value.linked_employee_id} options={employees} onChange={(linked_employee_id) => setValue({ ...value, linked_employee_id })} placeholder="Type employee name or ID" /> : null}
        <label className="text-xs font-semibold sm:col-span-2">Resource assignments<input className="compact-control mt-1 w-full" value={value.resource_assignments.join(", ")} onChange={(e) => setValue({ ...value, resource_assignments: e.target.value.split(",").map((item) => item.trim()).filter(Boolean) })} placeholder="Optional resource IDs, separated by commas" /></label>
      </div> : null}
      {section === "overrides" ? <div className="overflow-auto rounded border border-line"><table className="w-full min-w-[780px] text-xs"><thead className="sticky top-0 bg-[#f6f8f6]"><tr><th className="px-3 py-2 text-left">Permission</th><th className="w-28 px-2 py-2">Inherit</th><th className="w-28 px-2 py-2 text-emerald-700">Grant</th><th className="w-28 px-2 py-2 text-red-700">Deny</th></tr></thead><tbody className="divide-y divide-line">{permissionModules.flatMap((module) => module.actions.map((action) => { const mode = value.direct_denies.includes(action.permission) ? "deny" : value.direct_grants.includes(action.permission) ? "grant" : "inherit"; return <tr key={action.permission}><td className="px-3 py-1.5"><strong>{module.label}</strong><span className="ml-2 text-ink/45">{action.label}</span></td>{(["inherit","grant","deny"] as const).map((item) => <td key={item} className="px-2 text-center"><button disabled={immutable} type="button" onClick={() => setOverride(action.permission, item)} className={`mx-auto grid h-6 w-6 place-items-center rounded border ${mode === item ? item === "deny" ? "border-red-600 bg-red-600 text-white" : item === "grant" ? "border-emerald-600 bg-emerald-600 text-white" : "border-ink/40 bg-ink/5 text-ink" : "border-line text-transparent"}`}><Check className="h-3.5 w-3.5" /></button></td>)}</tr>; }))}</tbody></table></div> : null}
      {validationError || error ? <p className="mt-4 text-sm text-red-700">{validationError || error}</p> : null}
    </div>
    <footer className="flex justify-end gap-2 border-t border-line bg-paper/50 px-5 py-3"><button type="button" onClick={onCancel} className="secondary-button"><X className="h-4 w-4" /> Cancel</button><button disabled={saving || immutable} className="primary-button"><Save className="h-4 w-4" />{saving ? "Saving..." : "Save user"}</button></footer>
  </form></div>;
}
