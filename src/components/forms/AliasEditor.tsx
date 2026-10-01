import { Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { useState } from "react";
import type { OrganizationClient } from "../../types/organization";
import type { MemberAlias } from "../../types/payment";
import type { AliasInput } from "../../services/repositories/PaymentRepository";
import { normalizeIdentityName } from "../../services/imports/identityMatching";

type Props = {
  employeeId: string | null;
  clientId: string | null;
  aliases: MemberAlias[];
  clients: OrganizationClient[];
  saving: boolean;
  onSave: (input: AliasInput) => Promise<MemberAlias>;
  onArchive: (id: string) => Promise<void>;
};

export function AliasEditor({ employeeId, clientId, aliases, clients, saving, onSave, onArchive }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [alias, setAlias] = useState("");
  const [error, setError] = useState("");
  const records = aliases.filter((item) => item.employee_id === employeeId && !item.deleted_at);

  function reset() { setEditingId(null); setAlias(""); setError(""); }
  async function submit() {
    const existing = records.find((record) => record.id === editingId);
    const assignedClientId = existing?.client_id ?? clientId;
    if (!employeeId || !assignedClientId || !alias.trim()) return setError("A current client assignment and alias are required.");
    try { await onSave({ id: editingId ?? undefined, employee_id: employeeId, client_id: assignedClientId, alias: alias.trim(), normalized_alias: normalizeIdentityName(alias) }); reset(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Alias could not be saved."); }
  }

  if (!employeeId) return <p className="sm:col-span-2 rounded-md border border-dashed border-line bg-paper px-3 py-4 text-center text-xs text-ink/45">Save and link the employee record before adding payroll aliases.</p>;
  return <div className="sm:col-span-2 space-y-3">
    <div className="flex items-center justify-between gap-3 rounded-md border border-line bg-[#f8faf8] px-3 py-2 text-xs"><span className="text-ink/50">Assigned client</span><strong>{clients.find((client) => client.id === clientId)?.label ?? "No current client assignment"}</strong></div>
    <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
      <input className="control" disabled={!clientId && !editingId} value={alias} onChange={(event) => setAlias(event.target.value)} placeholder={clientId ? "Payroll name or alternate name" : "Assign the employee to a client first"} aria-label="Alias name" />
      <div className="flex gap-2"><button type="button" className="primary-button flex-1 sm:flex-none" disabled={saving} onClick={() => void submit()}>{editingId ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}{editingId ? "Update" : "Add"}</button>{editingId ? <button type="button" className="icon-button" title="Cancel alias edit" aria-label="Cancel alias edit" onClick={reset}><X className="h-4 w-4" /></button> : null}</div>
    </div>
    {error ? <p className="text-xs text-red-700">{error}</p> : null}
    <div className="divide-y divide-line rounded-md border border-line">{records.map((record) => <div key={record.id} className="flex items-center gap-3 px-3 py-2"><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold">{record.alias}</p><p className="truncate text-[11px] text-ink/45">{clients.find((client) => client.id === record.client_id)?.label ?? "Unavailable client"}</p></div><button type="button" className="icon-button h-8 w-8" title="Edit alias" aria-label={`Edit alias ${record.alias}`} onClick={() => { setEditingId(record.id); setAlias(record.alias); setError(""); }}><Pencil className="h-3.5 w-3.5" /></button><button type="button" className="icon-button h-8 w-8 text-red-600" title="Archive alias" aria-label={`Archive alias ${record.alias}`} onClick={() => { if (window.confirm(`Archive alias ${record.alias}?`)) void onArchive(record.id); }}><Trash2 className="h-3.5 w-3.5" /></button></div>)}{!records.length ? <p className="px-3 py-5 text-center text-xs text-ink/45">No aliases saved for this employee.</p> : null}</div>
  </div>;
}
