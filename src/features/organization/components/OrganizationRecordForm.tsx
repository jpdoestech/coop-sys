import { useEffect, useState, type FormEvent } from "react";
import { X } from "lucide-react";
import type { OrganizationBranch, OrganizationClient, OrganizationDepartment, OrganizationPosition } from "../../../types/organization";
import { HEAD_OFFICE_ID } from "../../../services/lookups/organization";
import { useOrganization } from "../../../services/organization/useOrganization";
import { CHARACTER_LIMITS } from "../../../utils/inputSanitizers";

export type OrganizationKind = "branch" | "client" | "department" | "position";
type RecordValue = OrganizationBranch | OrganizationClient | OrganizationDepartment | OrganizationPosition;
type Props = { kind: OrganizationKind; record: RecordValue | null; onCancel: () => void; onSaved: () => void };

export function OrganizationRecordForm({ kind, record, onCancel, onSaved }: Props) {
  const directory = useOrganization();
  const [code, setCode] = useState(""); const [name, setName] = useState(""); const [detail, setDetail] = useState("");
  const [parentId, setParentId] = useState(""); const [contactPerson, setContactPerson] = useState(""); const [contactDetails, setContactDetails] = useState(""); const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false); const [error, setError] = useState("");
  useEffect(() => {
    setCode(record?.code ?? ""); setName(record?.label ?? ""); setActive(record?.isActive ?? true); setError("");
    setDetail(record && "address" in record ? record.address : record && "description" in record ? record.description : "");
    setParentId(record && "branchId" in record ? record.branchId : record && "departmentId" in record ? record.departmentId : "");
    setContactPerson(record && "contactPerson" in record ? record.contactPerson : ""); setContactDetails(record && "contactDetails" in record ? record.contactDetails : "");
  }, [record, kind]);

  async function submit(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError("");
    try {
      const id = record?.id ?? crypto.randomUUID();
      if (kind === "branch") {
        const existingBranch = record && "type" in record ? record : null;
        await directory.saveBranch({ id, code: code.trim().toUpperCase(), label: name.trim(), address: detail.trim(), type: existingBranch?.type ?? "branch", parentId: existingBranch?.type === "head_office" ? null : HEAD_OFFICE_ID, isActive: active });
      }
      if (kind === "client") { if (!parentId) throw new Error("Select the responsible branch."); await directory.saveClient({ id, code: code.trim().toUpperCase(), label: name.trim(), branchId: parentId, address: detail.trim(), contactPerson: contactPerson.trim(), contactDetails: contactDetails.trim(), isActive: active }); }
      if (kind === "department") await directory.saveDepartment({ id, code: code.trim().toUpperCase(), label: name.trim(), description: detail.trim(), isActive: active });
      if (kind === "position") { if (!parentId) throw new Error("Select a department."); await directory.savePosition({ id, code: code.trim().toUpperCase(), label: name.trim(), departmentId: parentId, description: detail.trim(), isActive: active }); }
      onSaved();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Record could not be saved."); }
    finally { setSaving(false); }
  }

  const title = { branch: "branch", client: "client", department: "department", position: "position" }[kind];
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/45 p-4"><form onSubmit={submit} className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded border border-line bg-white shadow-2xl">
    <div className="flex items-center justify-between border-b border-line px-6 py-4"><div><p className="text-xs font-semibold uppercase text-moss">Organization</p><h2 className="font-display text-xl font-semibold">{record ? "Edit" : "Add"} {title}</h2></div><button type="button" onClick={onCancel} className="focus-ring rounded p-2 hover:bg-paper" aria-label="Close"><X className="h-5 w-5" /></button></div>
    <div className="grid gap-5 p-6 sm:grid-cols-2">
      <label className="text-sm font-medium">Code<input required maxLength={20} value={code} onChange={(event) => setCode(event.target.value.replace(/[^A-Za-z0-9_-]/g, ""))} className="focus-ring mt-1.5 w-full rounded border border-line px-3 py-2.5 uppercase" /></label>
      <label className="text-sm font-medium">Name<input required maxLength={CHARACTER_LIMITS.name} value={name} onChange={(event) => setName(event.target.value)} className="focus-ring mt-1.5 w-full rounded border border-line px-3 py-2.5" /></label>
      {kind === "client" ? <label className="text-sm font-medium sm:col-span-2">Responsible branch<select required value={parentId} onChange={(event) => setParentId(event.target.value)} className="focus-ring mt-1.5 w-full rounded border border-line bg-white px-3 py-2.5"><option value="">Select branch</option>{directory.branches.filter((item) => item.type === "branch" && item.isActive).map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label> : null}
      {kind === "position" ? <label className="text-sm font-medium sm:col-span-2">Department<select required value={parentId} onChange={(event) => setParentId(event.target.value)} className="focus-ring mt-1.5 w-full rounded border border-line bg-white px-3 py-2.5"><option value="">Select department</option>{directory.departments.filter((item) => item.isActive).map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label> : null}
      <label className="text-sm font-medium sm:col-span-2">{kind === "branch" || kind === "client" ? "Address" : "Description"}<textarea maxLength={CHARACTER_LIMITS.address} value={detail} onChange={(event) => setDetail(event.target.value)} rows={3} className="focus-ring mt-1.5 w-full resize-y rounded border border-line px-3 py-2.5" /></label>
      {kind === "client" ? <><label className="text-sm font-medium">Contact person<input maxLength={CHARACTER_LIMITS.name} value={contactPerson} onChange={(event) => setContactPerson(event.target.value)} className="focus-ring mt-1.5 w-full rounded border border-line px-3 py-2.5" /></label><label className="text-sm font-medium">Contact details<input maxLength={CHARACTER_LIMITS.address} value={contactDetails} onChange={(event) => setContactDetails(event.target.value)} className="focus-ring mt-1.5 w-full rounded border border-line px-3 py-2.5" /></label></> : null}
      <label className="flex items-center gap-3 text-sm font-medium sm:col-span-2"><input type="checkbox" disabled={Boolean(record && "type" in record && record.type === "head_office")} checked={active} onChange={(event) => setActive(event.target.checked)} />Active record</label>
      {error ? <p className="text-sm text-red-700 sm:col-span-2">{error}</p> : null}
    </div>
    <div className="flex justify-end gap-3 border-t border-line bg-paper/50 px-6 py-4"><button type="button" onClick={onCancel} className="focus-ring rounded border border-line bg-white px-4 py-2 text-sm font-semibold">Cancel</button><button disabled={saving} className="focus-ring rounded bg-moss px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Saving..." : "Save record"}</button></div>
  </form></div>;
}
