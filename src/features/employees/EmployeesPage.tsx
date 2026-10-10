import { FilterField } from "../../components/ui/FilterField";
import { SearchableSelect } from "../../components/ui/SearchableSelect";
import { useConfirmation } from "../../components/forms/unsavedChanges";
import { useDeferredValue, useEffect, useState } from "react";
import { ArrowUpDown, BriefcaseBusiness, CircleDotDashed, FileUp, Plus, Search } from "lucide-react";
import { ToolbarDisclosure } from "../../components/ui/ToolbarDisclosure";
import { RotateCcw, SlidersHorizontal } from "lucide-react";
import { PageHeader } from "../../components/ui/PageHeader";
import type { Employee } from "../../types/employee";
import { EmployeeForm } from "./components/EmployeeForm";
import { EmployeeTable } from "./components/EmployeeTable";
import { useEmployees } from "./hooks/useEmployees";
import type { EmployeeSubmission } from "./types/employeeWorkflow";
import { useAccess } from "../../services/access/useAccess";
import { useOrganization } from "../../services/organization/useOrganization";
import { employmentStatuses } from "./data/employeeOptions";
import { PaginationControls } from "../../components/ui/PaginationControls";
import { PlacementSelectors } from "../../components/forms/PlacementSelectors";
import { PersonImportDialog } from "../../components/forms/PersonImportDialog";
import { placementOptions } from "../../services/access/placementOptions";
import { MEMBER_STATUS } from "../../services/lookups/statuses";
import { useAliasManagement } from "../payments/hooks/useAliasManagement";
import { AliasEditor } from "../../components/forms/AliasEditor";

export function EmployeesPage() {
  const confirm = useConfirmation();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Employee | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const deferredSearch = useDeferredValue(search);
  const { can, profile } = useAccess();
  const canCreate = can("employees.create");
  const canImport = can("employees.import");
  const canEdit = can("employees.update");
  const canDelete = can("employees.delete");
  const { branches, clients, departments, positions } = useOrganization();
  const { branches: scopedBranches, clients: scopedClients } = placementOptions(profile, branches, clients);
  const [attentionOnly, setAttentionOnly] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");
  const [branchFilter, setBranchFilter] = useState("");
  const [clientFilter, setClientFilter] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [sort, setSort] = useState("name-asc");
  const [page, setPage] = useState(1);
const [pageSize, setPageSize] = useState(25);
  const { query, members, formerEmployees, personNumber, saveEmployee, archiveEmployee, importEmployees } = useEmployees({ search: deferredSearch, attentionOnly, statusId: statusFilter, branchId: branchFilter, clientId: clientFilter, departmentId: departmentFilter, sort, limit: pageSize, offset: (page - 1) * pageSize });
  const aliasManagement = useAliasManagement("employees.update");
  useEffect(() => setPage(1), [deferredSearch, attentionOnly, statusFilter, branchFilter, clientFilter, departmentFilter, sort, pageSize]);
  const pageEmployees = query.data?.items ?? [];

  function save(submission: EmployeeSubmission) {
    saveEmployee.mutate({ employee: editing, submission }, { onSuccess: () => setFormOpen(false) });
  }

  return (
    <>
      <PageHeader title="Employees" />
      <section className="overflow-visible rounded-md border border-line bg-white shadow-panel">
        <div className="data-toolbar" aria-label="Employee tools">
          <div className="relative min-w-[160px] flex-1 sm:max-w-72"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/35" /><input className="compact-control w-full pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search employees" aria-label="Search employees" /></div>
          <ToolbarDisclosure label="Employee filters" icon={SlidersHorizontal} count={[statusFilter, branchFilter, clientFilter, departmentFilter].filter(Boolean).length + Number(attentionOnly) + Number(sort !== "name-asc")}><div className="toolbar-filters">
            <FilterField label="Status"><div className="relative"><CircleDotDashed className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink/40" /><SearchableSelect aria-label="Filter employment status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="compact-control w-full pl-8"><option value="">All statuses</option>{employmentStatuses.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</SearchableSelect></div></FilterField>
            <FilterField label="Department"><div className="relative"><BriefcaseBusiness className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink/40" /><SearchableSelect aria-label="Filter department" value={departmentFilter} onChange={(event) => setDepartmentFilter(event.target.value)} className="compact-control w-full pl-8"><option value="">All departments</option>{departments.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</SearchableSelect></div></FilterField>
            <PlacementSelectors layout="filters" branchId={branchFilter} clientId={clientFilter} onBranchChange={(value) => { setBranchFilter(value); setClientFilter(""); }} onClientChange={setClientFilter} />
            <FilterField label="Sort Order" fullWidth><div className="relative"><ArrowUpDown className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink/40" /><SearchableSelect aria-label="Sort employees" value={sort} onChange={(event) => setSort(event.target.value)} className="compact-control w-full pl-8"><option value="name-asc">Name A-Z</option><option value="name-desc">Name Z-A</option><option value="number-asc">Employee number</option><option value="hired-desc">Newest hire</option></SearchableSelect></div></FilterField>
            <label className="filter-toggle"><input type="checkbox" checked={attentionOnly} onChange={(event) => setAttentionOnly(event.target.checked)} />Needs attention</label>
          </div></ToolbarDisclosure>
          <button type="button" className="icon-button" title="Reset filters" aria-label="Reset filters" onClick={() => { setStatusFilter(""); setDepartmentFilter(""); setBranchFilter(""); setClientFilter(""); setAttentionOnly(false); setSort("name-asc"); setSearch(""); }}><RotateCcw className="h-4 w-4" /></button>
          <span className="hidden whitespace-nowrap text-[11px] text-ink/40 sm:block">{query.data?.total ?? 0} records</span>
          {canCreate || canImport ? <div className="toolbar-actions">{canImport ? <button className="icon-button" title="Import employees from Excel" aria-label="Import employees from Excel" onClick={() => setImportOpen(true)}><FileUp className="h-4 w-4" /></button> : null}{canCreate ? <button className="primary-button" title="New employee" aria-label="New employee" onClick={() => { saveEmployee.reset(); setEditing(null); setFormOpen(true); }}><Plus className="h-4 w-4" /><span className="hidden sm:inline">New employee</span></button> : null}</div> : null}
        </div>
        {query.isError ? <div className="border-t border-line px-5 py-8 text-sm text-red-700">Unable to load employee records.</div> : <EmployeeTable employees={pageEmployees} loading={query.isLoading} canEdit={canEdit} canDelete={canDelete} onEdit={(employee) => { saveEmployee.reset(); setEditing(employee); setFormOpen(true); }} onArchive={(employee) => { confirm(`Archive ${employee.first_name} ${employee.last_name}?`, () => archiveEmployee.mutate(employee.id), "Archive employee", "Archive"); }} />}
        <PaginationControls page={page} pageSize={pageSize} total={query.data?.total ?? 0} onPageChange={setPage} onPageSizeChange={setPageSize} />
      </section>
      {formOpen ? <EmployeeForm employee={editing} suggestedNumber={personNumber.data ?? ""} members={members.data ?? []} formerEmployees={formerEmployees.data ?? []} saving={saveEmployee.isPending} saveError={saveEmployee.error?.message} canViewSensitive={can("employees.sensitive.view")} canEditSensitive={can("employees.sensitive.update")} aliasEditor={canEdit ? <AliasEditor employeeId={editing?.id ?? null} clientId={editing?.active_assignment?.client_id ?? null} aliases={aliasManagement.query.data ?? []} clients={scopedClients} saving={aliasManagement.save.isPending} onSave={aliasManagement.save.mutateAsync} onArchive={aliasManagement.archive.mutateAsync} /> : undefined} onCancel={() => setFormOpen(false)} onSubmit={save} /> : null}
      {importOpen ? <PersonImportDialog kind="employee" branches={scopedBranches} clients={scopedClients} lookups={{ departments, positions }} requireClient={profile.scopeType === "assigned_clients"} linkOptions={(members.data ?? []).map((member) => ({ id: member.id, number: member.membership_number, name: `${member.last_name}, ${member.first_name}`, isActive: member.membership_status_id === MEMBER_STATUS.active }))} importing={importEmployees.isPending} importError={importEmployees.error?.message} onClose={() => setImportOpen(false)} onImport={(rows, branchId, clientId, onProgress) => importEmployees.mutateAsync({ rows, branchId, clientId, onProgress })} /> : null}
    </>
  );
}
