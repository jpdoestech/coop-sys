import { useMemo, useState } from "react";
import { BriefcaseBusiness, Building2, Network, Pencil, Plus, Search, UsersRound } from "lucide-react";
import { PageHeader } from "../../components/ui/PageHeader";
import { useOrganization } from "../../services/organization/useOrganization";
import type { OrganizationBranch, OrganizationClient, OrganizationDepartment, OrganizationPosition } from "../../types/organization";
import { OrganizationRecordForm, type OrganizationKind } from "./components/OrganizationRecordForm";

type RecordValue = OrganizationBranch | OrganizationClient | OrganizationDepartment | OrganizationPosition;
const tabs: Array<{ id: OrganizationKind; label: string; icon: typeof Building2 }> = [
  { id: "branch", label: "Offices & branches", icon: Building2 }, { id: "client", label: "Branch clients", icon: BriefcaseBusiness },
  { id: "department", label: "Departments", icon: Network }, { id: "position", label: "Positions", icon: UsersRound },
];

export function OrganizationPage() {
  const directory = useOrganization();
  const [kind, setKind] = useState<OrganizationKind>("branch");
  const [editing, setEditing] = useState<RecordValue | null>(null);
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState("active");
  const [search, setSearch] = useState("");
  const records = useMemo<RecordValue[]>(() => {
    const values = kind === "branch" ? directory.branches : kind === "client" ? directory.clients : kind === "department" ? directory.departments : directory.positions;
    const term = search.trim().toLowerCase();
    return values.filter((item) => (status === "all" || item.isActive === (status === "active")) && (!term || item.label.toLowerCase().includes(term) || item.code.toLowerCase().includes(term)));
  }, [directory.branches, directory.clients, directory.departments, directory.positions, kind, search, status]);

  function relation(record: RecordValue) {
    if ("branchId" in record) return directory.branches.find((item) => item.id === record.branchId)?.label ?? "Unassigned";
    if ("departmentId" in record) return directory.departments.find((item) => item.id === record.departmentId)?.label ?? "Unassigned";
    if ("type" in record) return record.type === "head_office" ? "Top-level office" : "Under Head Office";
    return "Internal department";
  }

  return <>
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><PageHeader eyebrow="Organization" title="Organization administration" description="Maintain the Head Office hierarchy, branches, branch clients, departments, and positions." /><button onClick={() => { setEditing(null); setOpen(true); }} disabled={kind === "branch" && !directory.branches.some((item) => item.type === "head_office")} className="primary-button mb-3"><Plus className="h-4 w-4" /> Add {kind}</button></div>
    <div className="overflow-x-auto"><div className="inline-flex min-w-max rounded-md border border-line bg-white p-1 shadow-sm">{tabs.map((tab) => <button key={tab.id} onClick={() => { setKind(tab.id); setSearch(""); }} className={`focus-ring inline-flex items-center gap-2 whitespace-nowrap rounded px-3 py-2 text-xs font-semibold transition ${kind === tab.id ? "bg-[#e4efe9] text-moss" : "text-ink/55 hover:bg-paper hover:text-ink"}`}><tab.icon className="h-3.5 w-3.5" />{tab.label}</button>)}</div></div>
    <section className="mt-4 overflow-hidden rounded-md border border-line bg-white shadow-panel">
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center"><div className="relative min-w-0 flex-1 sm:max-w-xl"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/35" /><input value={search} onChange={(event) => setSearch(event.target.value)} className="control w-full pl-9" placeholder={`Search ${tabs.find((item) => item.id === kind)?.label.toLowerCase()}`} aria-label="Search organization records" /></div><p className="hidden whitespace-nowrap text-xs text-ink/45 md:block">{records.length} records</p><select aria-label="Filter organization status" value={status} onChange={(event) => setStatus(event.target.value)} className="control"><option value="active">Active records</option><option value="inactive">Inactive records</option><option value="all">All statuses</option></select></div>
      <div className="max-h-[58vh] overflow-auto border-t border-line"><table className="w-full min-w-[720px] text-left text-sm"><thead className="sticky top-0 z-10"><tr className="border-b border-line bg-[#f8faf8] text-[11px] uppercase text-ink/45"><th className="px-5 py-3">Code</th><th className="px-4 py-3">Name</th><th className="px-4 py-3">Parent / group</th><th className="px-4 py-3">Status</th><th className="w-16 px-4 py-3 text-right">Action</th></tr></thead><tbody className="divide-y divide-line">{records.map((record) => <tr key={record.id} className="transition-colors hover:bg-[#f8faf8]"><td className="px-5 py-3.5 font-mono text-xs text-ink/55">{record.code}</td><td className="px-4 py-3.5 font-semibold">{record.label}</td><td className="px-4 py-3.5 text-ink/60">{relation(record)}</td><td className="px-4 py-3.5">{record.isActive ? <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />Active</span> : <span className="rounded-full bg-paper px-2 py-1 text-xs text-ink/50">Inactive</span>}</td><td className="px-4 py-3.5 text-right"><button onClick={() => { setEditing(record); setOpen(true); }} className="icon-button" title="Edit record" aria-label={`Edit ${record.label}`}><Pencil className="h-4 w-4" /></button></td></tr>)}</tbody></table>{!directory.loading && !records.length ? <p className="px-5 py-12 text-center text-sm text-ink/55">No records match your search and status.</p> : null}</div>
    </section>
    {open ? <OrganizationRecordForm kind={kind} record={editing} onCancel={() => setOpen(false)} onSaved={() => setOpen(false)} /> : null}
  </>;
}
