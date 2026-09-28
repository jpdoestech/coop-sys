import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { ArrowUpDown, Plus, Search } from "lucide-react";
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
import { FilterMenu } from "../../components/ui/FilterMenu";

export function EmployeesPage() {
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Employee | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const deferredSearch = useDeferredValue(search);
  const { query, members, formerEmployees, saveEmployee, archiveEmployee } = useEmployees(deferredSearch);
  const { can } = useAccess();
  const canManage = can("employees.manage");
  const { branches, clients, departments } = useOrganization();
  const [statusFilter, setStatusFilter] = useState("");
  const [branchFilter, setBranchFilter] = useState("");
  const [clientFilter, setClientFilter] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [sort, setSort] = useState("name-asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const activeFilterCount = [statusFilter, branchFilter, clientFilter, departmentFilter].filter(Boolean).length;
  const filteredEmployees = useMemo(() => [...(query.data ?? [])].filter((employee) => (!statusFilter || employee.employment_status_id === statusFilter) && (!branchFilter || employee.active_assignment?.branch_id === branchFilter) && (!clientFilter || employee.active_assignment?.client_id === clientFilter) && (!departmentFilter || employee.department_id === departmentFilter)).sort((a, b) => sort === "name-desc" ? b.last_name.localeCompare(a.last_name) : sort === "number-asc" ? a.employee_number.localeCompare(b.employee_number) : sort === "hired-desc" ? (b.date_hired ?? "").localeCompare(a.date_hired ?? "") : a.last_name.localeCompare(b.last_name)), [query.data, statusFilter, branchFilter, clientFilter, departmentFilter, sort]);
  useEffect(() => setPage(1), [deferredSearch, statusFilter, branchFilter, clientFilter, departmentFilter, sort, pageSize]);
  const pageEmployees = filteredEmployees.slice((page - 1) * pageSize, page * pageSize);

  function save(submission: EmployeeSubmission) {
    saveEmployee.mutate({ employee: editing, submission }, { onSuccess: () => setFormOpen(false) });
  }

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader eyebrow="Employees" title="Employee records" description="Manage employment, cooperative membership links, client deployments, and beneficiary records." />
        {canManage ? <button className="primary-button mb-3" onClick={() => { saveEmployee.reset(); setEditing(null); setFormOpen(true); }}><Plus className="h-4 w-4" /> New employee</button> : null}
      </div>
      <section className="overflow-visible rounded-md border border-line bg-white shadow-panel">
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1 sm:max-w-xl"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/35" /><input className="control w-full pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search employees" aria-label="Search employees" /></div>
          <p className="hidden whitespace-nowrap text-xs text-ink/45 md:block">{filteredEmployees.length} records</p>
          <div className="flex items-center gap-2 self-stretch sm:self-auto">
            <FilterMenu activeCount={activeFilterCount} onClear={() => { setStatusFilter(""); setDepartmentFilter(""); setBranchFilter(""); setClientFilter(""); }}>
              <label className="block text-xs font-semibold text-ink/60">Employment status<select aria-label="Filter employment status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="control mt-1.5 w-full font-normal"><option value="">All statuses</option>{employmentStatuses.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
              <label className="block text-xs font-semibold text-ink/60">Department<select aria-label="Filter department" value={departmentFilter} onChange={(event) => setDepartmentFilter(event.target.value)} className="control mt-1.5 w-full font-normal"><option value="">All departments</option>{departments.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
              <label className="block text-xs font-semibold text-ink/60">Office or branch<select aria-label="Filter employee branch" value={branchFilter} onChange={(event) => { setBranchFilter(event.target.value); setClientFilter(""); }} className="control mt-1.5 w-full font-normal"><option value="">All offices and branches</option>{branches.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
              <label className="block text-xs font-semibold text-ink/60">Client<select aria-label="Filter employee client" value={clientFilter} onChange={(event) => setClientFilter(event.target.value)} className="control mt-1.5 w-full font-normal"><option value="">All clients</option>{clients.filter((item) => !branchFilter || item.branchId === branchFilter).map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
            </FilterMenu>
            <div className="relative flex-1 sm:flex-none"><ArrowUpDown className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/40" /><select aria-label="Sort employees" value={sort} onChange={(event) => setSort(event.target.value)} className="control w-full pl-9 sm:w-40"><option value="name-asc">Name A-Z</option><option value="name-desc">Name Z-A</option><option value="number-asc">Employee number</option><option value="hired-desc">Newest hire</option></select></div>
          </div>
        </div>
        {query.isError ? <div className="border-t border-line px-5 py-8 text-sm text-red-700">Unable to load employee records.</div> : <EmployeeTable employees={pageEmployees} loading={query.isLoading} canManage={canManage} onEdit={(employee) => { saveEmployee.reset(); setEditing(employee); setFormOpen(true); }} onArchive={(employee) => { if (window.confirm(`Archive ${employee.first_name} ${employee.last_name}?`)) archiveEmployee.mutate(employee.id); }} />}
        <PaginationControls page={page} pageSize={pageSize} total={filteredEmployees.length} onPageChange={setPage} onPageSizeChange={setPageSize} />
      </section>
      {formOpen ? <EmployeeForm employee={editing} members={members.data ?? []} formerEmployees={formerEmployees.data ?? []} saving={saveEmployee.isPending} saveError={saveEmployee.error?.message} onCancel={() => setFormOpen(false)} onSubmit={save} /> : null}
    </>
  );
}
