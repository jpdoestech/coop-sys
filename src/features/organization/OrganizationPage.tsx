import { useMemo, useState } from "react";
import { Building2, Pencil, Plus } from "lucide-react";
import { PageHeader } from "../../components/ui/PageHeader";
import { useOrganization } from "../../services/organization/useOrganization";
import type { OrganizationBranch, OrganizationClient, OrganizationDepartment, OrganizationPosition } from "../../types/organization";
import { OrganizationRecordForm, type OrganizationKind } from "./components/OrganizationRecordForm";

type RecordValue = OrganizationBranch | OrganizationClient | OrganizationDepartment | OrganizationPosition;
const tabs: Array<{ id: OrganizationKind; label: string }> = [
  { id: "branch", label: "Offices & branches" }, { id: "client", label: "Branch clients" },
  { id: "department", label: "Departments" }, { id: "position", label: "Positions" },
];

export function OrganizationPage() {
  const directory = useOrganization();
  const [kind, setKind] = useState<OrganizationKind>("branch");
  const [editing, setEditing] = useState<RecordValue | null>(null);
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState("active");
  const records = useMemo<RecordValue[]>(() => {
    const values = kind === "branch" ? directory.branches : kind === "client" ? directory.clients : kind === "department" ? directory.departments : directory.positions;
    return values.filter((item) => status === "all" || item.isActive === (status === "active"));
  }, [directory.branches, directory.clients, directory.departments, directory.positions, kind, status]);

  function relation(record: RecordValue) {
    if ("branchId" in record) return directory.branches.find((item) => item.id === record.branchId)?.label ?? "Unassigned";
    if ("departmentId" in record) return directory.departments.find((item) => item.id === record.departmentId)?.label ?? "Unassigned";
    if ("type" in record) return record.type === "head_office" ? "Top-level office" : "Under Head Office";
    return "Internal department";
  }

  return <>
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><PageHeader eyebrow="Organization" title="Organization administration" description="Maintain the Head Office hierarchy, branches, branch clients, departments, and positions." /><button onClick={() => { setEditing(null); setOpen(true); }} disabled={kind === "branch" && !directory.branches.some((item) => item.type === "head_office")} className="focus-ring mb-6 inline-flex items-center justify-center gap-2 rounded bg-moss px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"><Plus className="h-4 w-4" /> Add {kind}</button></div>
    <div className="border-b border-line"><div className="flex gap-1 overflow-x-auto">{tabs.map((tab) => <button key={tab.id} onClick={() => setKind(tab.id)} className={`focus-ring whitespace-nowrap border-b-2 px-4 py-3 text-sm font-semibold ${kind === tab.id ? "border-moss text-moss" : "border-transparent text-ink/60 hover:text-ink"}`}>{tab.label}</button>)}</div></div>
    <section className="mt-5 overflow-hidden rounded border border-line bg-white shadow-panel">
      <div className="flex items-center justify-between gap-4 px-5 py-4"><div className="flex items-center gap-2"><Building2 className="h-5 w-5 text-moss" /><p className="text-sm font-semibold">{tabs.find((item) => item.id === kind)?.label}</p></div><select value={status} onChange={(event) => setStatus(event.target.value)} className="focus-ring rounded border border-line bg-white px-3 py-2 text-sm"><option value="active">Active</option><option value="inactive">Inactive</option><option value="all">All statuses</option></select></div>
      <div className="max-h-[58vh] overflow-auto border-t border-line"><table className="w-full min-w-[720px] text-left text-sm"><thead className="sticky top-0 z-10"><tr className="bg-ink text-xs uppercase text-white"><th className="px-5 py-3">Code</th><th className="px-4 py-3">Name</th><th className="px-4 py-3">Parent / group</th><th className="px-4 py-3">Status</th><th className="w-16 px-4 py-3 text-right">Action</th></tr></thead><tbody className="divide-y divide-line">{records.map((record) => <tr key={record.id} className="hover:bg-paper/70"><td className="px-5 py-3.5 font-mono text-xs">{record.code}</td><td className="px-4 py-3.5 font-semibold">{record.label}</td><td className="px-4 py-3.5 text-ink/65">{relation(record)}</td><td className="px-4 py-3.5">{record.isActive ? <span className="text-emerald-700">Active</span> : <span className="text-ink/50">Inactive</span>}</td><td className="px-4 py-3.5 text-right"><button onClick={() => { setEditing(record); setOpen(true); }} className="focus-ring rounded p-2 hover:bg-white" title="Edit record" aria-label={`Edit ${record.label}`}><Pencil className="h-4 w-4" /></button></td></tr>)}</tbody></table>{!directory.loading && !records.length ? <p className="px-5 py-12 text-center text-sm text-ink/55">No records match this status.</p> : null}</div>
    </section>
    {open ? <OrganizationRecordForm kind={kind} record={editing} onCancel={() => setOpen(false)} onSaved={() => setOpen(false)} /> : null}
  </>;
}
