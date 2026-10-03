import { useEffect, useState, type FormEvent } from "react";
import { Copy, Save, X } from "lucide-react";
import type { AccessRole } from "../../../services/access/accessControl";
import type { AccessRoleInput } from "../../../services/repositories/UserAccessRepository";
import { PermissionMatrix } from "./PermissionMatrix";

type Props = { role: AccessRole | null; clone?: boolean; saving: boolean; error?: string; onCancel: () => void; onSubmit: (input: AccessRoleInput) => void };
const empty: AccessRoleInput = { code: "", name: "", description: "", permissions: [], is_active: true };

export function RoleEditorDialog({ role, clone, saving, error, onCancel, onSubmit }: Props) {
  const [value, setValue] = useState(empty);
  useEffect(() => setValue(role ? { code: clone ? `${role.code}_copy` : role.code, name: clone ? `${role.name} Copy` : role.name, description: role.description, permissions: [...role.permissions], is_active: role.is_active } : empty), [role, clone]);
  const immutable = Boolean(role?.is_system && !clone);
  function submit(event: FormEvent) { event.preventDefault(); onSubmit({ ...value, code: value.code.trim(), name: value.name.trim(), description: value.description.trim() }); }
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/45 p-3"><form onSubmit={submit} className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-md border border-line bg-white shadow-2xl">
    <header className="flex items-center justify-between border-b border-line px-5 py-3"><div><p className="text-[10px] font-bold uppercase text-moss">Role policy</p><h2 className="text-lg font-semibold">{clone ? "Clone role" : role ? "Edit role" : "Create role"}</h2></div><button type="button" onClick={onCancel} className="icon-button" aria-label="Close"><X className="h-4 w-4" /></button></header>
    <div className="grid min-h-0 gap-4 overflow-y-auto p-5">
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_2fr_auto]">
        <label className="text-xs font-semibold">Role name<input required maxLength={80} className="compact-control mt-1 w-full" value={value.name} onChange={(e) => setValue({ ...value, name: e.target.value })} /></label>
        <label className="text-xs font-semibold">Code<input required disabled={Boolean(role && !clone)} maxLength={60} className="compact-control mt-1 w-full disabled:bg-paper" value={value.code} onChange={(e) => setValue({ ...value, code: e.target.value })} /></label>
        <label className="text-xs font-semibold">Description<input maxLength={180} className="compact-control mt-1 w-full" value={value.description} onChange={(e) => setValue({ ...value, description: e.target.value })} /></label>
        <label className="flex items-end gap-2 pb-2 text-xs font-semibold"><input type="checkbox" disabled={immutable} checked={value.is_active} onChange={(e) => setValue({ ...value, is_active: e.target.checked })} /> Active</label>
      </div>
      {immutable ? <p className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">Super Admin is always unrestricted and cannot be changed.</p> : null}
      <PermissionMatrix value={value.permissions} onChange={(permissions) => setValue({ ...value, permissions })} disabled={immutable} compact />
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
    </div>
    <footer className="flex justify-end gap-2 border-t border-line bg-paper/50 px-5 py-3"><button type="button" onClick={onCancel} className="secondary-button"><X className="h-4 w-4" /> Cancel</button><button disabled={saving || immutable} className="primary-button">{clone ? <Copy className="h-4 w-4" /> : <Save className="h-4 w-4" />}{saving ? "Saving..." : clone ? "Create copy" : "Save role"}</button></footer>
  </form></div>;
}
