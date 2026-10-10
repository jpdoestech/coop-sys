import { useState } from "react";
import { useWorkspaceDialog, WorkspaceBreadcrumbs } from "../layout/WorkspaceNavigation";
import { LoaderCircle, Plus, Save, X } from "lucide-react";
import { useOrganization } from "../../services/organization/useOrganization";
import { useAccess } from "../../services/access/useAccess";
import { assertPermission } from "../../services/access/accessControl";
import { createUuid } from "../../utils/createUuid";
import { normalizeWhitespace, CHARACTER_LIMITS } from "../../utils/inputSanitizers";
import { withActivity } from "../../services/activity/activityStore";
import { SearchableSelect } from "../ui/SearchableSelect";
import { resolveEmploymentClassification, type EmploymentClassification } from "../../services/organization/employmentClassification";
import { useUnsavedChanges } from "./unsavedChanges";

export function EmploymentClassificationFields({ value, onChange, disabled = false }: { value: EmploymentClassification; onChange: (value: EmploymentClassification) => void; disabled?: boolean }) {
  const directory = useOrganization(); const { can } = useAccess();
  const [creating, setCreating] = useState<{ kind: "department" | "position"; name: string } | null>(null);
  const department = directory.departments.find((item) => item.id === value.department_id);
  const position = directory.positions.find((item) => item.id === value.position_id);
  const changeDepartment = (text: string) => onChange(resolveEmploymentClassification(text, position?.label || value.pending_position_name || "", directory.departments, directory.positions));
  const changePosition = (text: string) => onChange(resolveEmploymentClassification(department?.label || value.pending_department_name || "", text, directory.departments, directory.positions));
  const createAllowed = can("organization.create") && !disabled;
  return <>
    <div className="min-w-0"><span className="block text-xs font-semibold text-ink/75">Department</span><div className="flex items-center gap-1"><SearchableSelect aria-label="Department" className={`control mt-1.5 w-full ${value.pending_department_name ? "border-amber-400 bg-amber-50" : ""}`} disabled={disabled} value={value.department_id || (value.pending_department_name ? "pending" : "")} onChange={(event) => changeDepartment(event.target.value === "pending" ? value.pending_department_name || "" : event.target.value)} onCustomValue={changeDepartment} onCreate={createAllowed ? (name) => setCreating({ kind: "department", name: name || value.pending_department_name || "" }) : undefined} createLabel="Add department"><option value="">Not set</option>{value.pending_department_name ? <option value="pending">{value.pending_department_name} (unmapped)</option> : null}{directory.departments.filter((item) => item.isActive).map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</SearchableSelect>{createAllowed ? <button type="button" className="icon-button mt-1.5 shrink-0" title="Add department" aria-label="Add department" onClick={() => setCreating({ kind: "department", name: value.pending_department_name || "" })}><Plus className="h-4 w-4" /></button> : null}</div></div>
    <div className="min-w-0"><span className="block text-xs font-semibold text-ink/75">Position</span><div className="flex items-center gap-1"><SearchableSelect aria-label="Position" className={`control mt-1.5 w-full ${value.pending_position_name ? "border-amber-400 bg-amber-50" : ""}`} disabled={disabled} value={value.position_id || (value.pending_position_name ? "pending" : "")} onChange={(event) => changePosition(event.target.value === "pending" ? value.pending_position_name || "" : event.target.value)} onCustomValue={changePosition} onCreate={createAllowed ? (name) => setCreating({ kind: "position", name: name || value.pending_position_name || "" }) : undefined} createLabel="Add position"><option value="">Not set</option>{value.pending_position_name ? <option value="pending">{value.pending_position_name} (unmapped)</option> : null}{directory.positions.filter((item) => item.isActive && (!value.department_id || item.departmentId === value.department_id)).map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</SearchableSelect>{createAllowed ? <button type="button" className="icon-button mt-1.5 shrink-0" title="Add position" aria-label="Add position" onClick={() => setCreating({ kind: "position", name: value.pending_position_name || "" })}><Plus className="h-4 w-4" /></button> : null}</div></div>
    {creating && createAllowed ? <ClassificationCreateDialog kind={creating.kind} initialName={creating.name} departmentId={value.department_id || ""} onClose={() => setCreating(null)} onCreated={(id, parentId) => { onChange(creating.kind === "department" ? { ...value, department_id: id, pending_department_name: null, position_id: null, pending_position_name: position?.label || value.pending_position_name || null } : { ...value, department_id: parentId, pending_department_name: null, position_id: id, pending_position_name: null }); setCreating(null); }} /> : null}
  </>;
}

function ClassificationCreateDialog({ kind, initialName, departmentId, onClose, onCreated }: { kind: "department" | "position"; initialName: string; departmentId: string; onClose: () => void; onCreated: (id: string, departmentId: string) => void }) {
  useWorkspaceDialog(kind === "department" ? "Add Department" : "Add Position", onClose);
  const directory = useOrganization(); const { profile } = useAccess();
  const [name, setName] = useState(initialName), [code, setCode] = useState(initialName.toUpperCase().replace(/[^A-Z0-9]+/g, "_").slice(0, 20)), [parent, setParent] = useState(departmentId), [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false), [error, setError] = useState("");
  const { confirmDiscard } = useUnsavedChanges(name !== initialName || Boolean(description) || code !== initialName.toUpperCase().replace(/[^A-Z0-9]+/g, "_").slice(0, 20) || parent !== departmentId, saving);
  async function save() {
    if (saving) return;
    setSaving(true); setError("");
    try {
      assertPermission(profile, "organization.create");
      const label = normalizeWhitespace(name), recordCode = (code.trim() || label.replace(/[^a-zA-Z0-9]+/g, "_").slice(0, 20)).toUpperCase();
      if (!label || !/^[A-Z0-9_-]{1,20}$/.test(recordCode)) throw new Error("Enter a name and a code of up to 20 letters, digits, dashes or underscores.");
      if (kind === "position" && !directory.departments.some((item) => item.id === parent && item.isActive)) throw new Error("Select an active department.");
      const id = createUuid();
      await withActivity(`Adding ${kind}...`, () => kind === "department" ? directory.saveDepartment({ id, code: recordCode, label, description: description.trim(), isActive: true }) : directory.savePosition({ id, code: recordCode, label, departmentId: parent, description: description.trim(), isActive: true }));
      onCreated(id, parent);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Record could not be added."); } finally { setSaving(false); }
  }
  return <div className="fixed inset-0 z-[90] flex items-center justify-center bg-ink/50 p-3"><section role="dialog" aria-modal="true" aria-labelledby="classification-create-title" className="w-full max-w-lg overflow-hidden rounded-md bg-white shadow-2xl"><header className="flex items-center justify-between border-b border-line p-3"><div className="min-w-0 flex-1 pr-2"><WorkspaceBreadcrumbs dialog /><h3 id="classification-create-title" className="sr-only">Add {kind}</h3></div><button type="button" className="icon-button" aria-label="Close classification creation" disabled={saving} onClick={() => confirmDiscard(onClose)}><X className="h-4 w-4" /></button></header><div className="grid gap-3 p-4 sm:grid-cols-2"><label className="field-label">Code<input aria-label="Classification code" className="compact-control mt-1 w-full" maxLength={20} value={code} disabled={saving} onChange={(event) => setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ""))} /></label><label className="field-label">Name<input aria-label="Classification name" className="compact-control mt-1 w-full" maxLength={CHARACTER_LIMITS.name} value={name} disabled={saving} onChange={(event) => { setName(event.target.value);  }} /></label>{kind === "position" ? <label className="field-label sm:col-span-2">Department<SearchableSelect aria-label="Position department" className="compact-control mt-1 w-full" value={parent} disabled={saving} onChange={(event) => setParent(event.target.value)}><option value="">Select department</option>{directory.departments.filter((item) => item.isActive).map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</SearchableSelect></label> : null}<label className="field-label sm:col-span-2">Description<textarea className="compact-control mt-1 w-full" maxLength={CHARACTER_LIMITS.address} value={description} disabled={saving} onChange={(event) => setDescription(event.target.value)} /></label>{error ? <p role="alert" className="text-xs text-red-700 sm:col-span-2">{error}</p> : null}</div><footer className="flex justify-end gap-2 border-t border-line p-3"><button type="button" className="secondary-button" disabled={saving} onClick={() => confirmDiscard(onClose)}><X className="h-4 w-4" />Cancel</button><button type="button" className="primary-button" disabled={saving} onClick={() => void save()}>{saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{saving ? "Saving..." : "Save"}</button></footer></section></div>;
}
