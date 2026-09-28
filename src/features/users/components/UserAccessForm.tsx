import { useEffect, useState, type FormEvent } from "react";
import { X } from "lucide-react";
import { roleDefinitions } from "../../../services/access/accessControl";
import { branches, HEAD_OFFICE_ID } from "../../../services/lookups/organization";
import type { SystemUser, SystemUserInput } from "../../../types/systemUser";
import { CHARACTER_LIMITS } from "../../../utils/inputSanitizers";

type Props = {
  user: SystemUser | null;
  saving: boolean;
  error?: string;
  onCancel: () => void;
  onSubmit: (input: SystemUserInput) => void;
  offline: boolean;
};

const emptyUser: SystemUserInput = {
  display_name: "",
  email: "",
  role: "branch_user",
  branch_ids: [],
  is_active: true,
  temporary_password: "",
};

export function UserAccessForm({ user, saving, error, onCancel, onSubmit, offline }: Props) {
  const [value, setValue] = useState<SystemUserInput>(emptyUser);
  const [validationError, setValidationError] = useState("");
  useEffect(() => {
    setValue(user ? {
      display_name: user.display_name,
      email: user.email,
      role: user.role,
      branch_ids: user.branch_ids,
      is_active: user.is_active,
      temporary_password: "",
    } : emptyUser);
    setValidationError("");
  }, [user]);

  function submit(event: FormEvent) {
    event.preventDefault();
    if ((value.role === "branch_admin" || value.role === "branch_user") && value.branch_ids.length === 0) {
      setValidationError("Assign at least one branch to this role.");
      return;
    }
    onSubmit({ ...value, email: value.email.trim().toLowerCase(), display_name: value.display_name.trim() });
  }

  const branchScoped = value.role === "branch_admin" || value.role === "branch_user";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/45 p-4">
      <form onSubmit={submit} className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded border border-line bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-line px-6 py-4">
          <div><p className="text-xs font-semibold uppercase text-moss">Access control</p><h2 className="font-display text-xl font-semibold">{user ? "Edit system user" : "Add system user"}</h2></div>
          <button type="button" onClick={onCancel} className="focus-ring rounded p-2 hover:bg-paper" aria-label="Close"><X className="h-5 w-5" /></button>
        </div>
        <div className="grid gap-5 p-6 sm:grid-cols-2">
          <label className="text-sm font-medium">Display name<input required maxLength={CHARACTER_LIMITS.name} value={value.display_name} onChange={(event) => setValue({ ...value, display_name: event.target.value })} className="focus-ring mt-1.5 w-full rounded border border-line px-3 py-2.5" /></label>
          <label className="text-sm font-medium">Email address<input required readOnly={!offline && Boolean(user)} type="email" maxLength={254} value={value.email} onChange={(event) => setValue({ ...value, email: event.target.value })} className="focus-ring mt-1.5 w-full rounded border border-line px-3 py-2.5 read-only:bg-paper read-only:text-ink/60" /></label>
          <label className="text-sm font-medium sm:col-span-2">System role<select value={value.role} onChange={(event) => { const role = event.target.value as SystemUserInput["role"]; setValue({ ...value, role, branch_ids: role === "branch_admin" || role === "branch_user" ? value.branch_ids : [] }); }} className="focus-ring mt-1.5 w-full rounded border border-line bg-white px-3 py-2.5">{roleDefinitions.map((role) => <option key={role.code} value={role.code}>{role.label}</option>)}</select></label>
          {offline ? <label className="text-sm font-medium sm:col-span-2">{user ? "Reset with temporary password" : "Temporary password"}<input required={!user} type="password" autoComplete="new-password" minLength={12} maxLength={128} value={value.temporary_password ?? ""} onChange={(event) => setValue({ ...value, temporary_password: event.target.value })} className="focus-ring mt-1.5 w-full rounded border border-line px-3 py-2.5" /><span className="mt-1 block text-xs font-normal text-ink/55">{user ? "Leave blank to keep the current password." : "The user must replace this password at first sign-in."}</span></label> : !user ? <p className="text-sm text-ink/60 sm:col-span-2">An invitation will be sent to this email address.</p> : null}
          {branchScoped ? <fieldset className="sm:col-span-2"><legend className="text-sm font-medium">Assigned branches</legend><div className="mt-2 grid gap-2 sm:grid-cols-2">{branches.filter((branch) => branch.id !== HEAD_OFFICE_ID).map((branch) => <label key={branch.id} className="flex items-center gap-3 rounded border border-line px-3 py-2.5 text-sm"><input type="checkbox" checked={value.branch_ids.includes(branch.id)} onChange={(event) => setValue({ ...value, branch_ids: event.target.checked ? [...value.branch_ids, branch.id] : value.branch_ids.filter((id) => id !== branch.id) })} />{branch.label}</label>)}</div></fieldset> : null}
          <label className="flex items-center gap-3 text-sm font-medium sm:col-span-2"><input type="checkbox" checked={value.is_active} onChange={(event) => setValue({ ...value, is_active: event.target.checked })} />Active system access</label>
          {validationError || error ? <p className="text-sm text-red-700 sm:col-span-2">{validationError || error}</p> : null}
        </div>
        <div className="flex justify-end gap-3 border-t border-line bg-paper/50 px-6 py-4"><button type="button" onClick={onCancel} className="focus-ring rounded border border-line bg-white px-4 py-2 text-sm font-semibold">Cancel</button><button disabled={saving} className="focus-ring rounded bg-moss px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Saving..." : "Save user"}</button></div>
      </form>
    </div>
  );
}
