import { useDeferredValue, useState } from "react";
import { Plus, Search } from "lucide-react";
import { PageHeader } from "../../components/ui/PageHeader";
import type { Employee } from "../../types/employee";
import { EmployeeForm } from "./components/EmployeeForm";
import { EmployeeTable } from "./components/EmployeeTable";
import { useEmployees } from "./hooks/useEmployees";
import type { EmployeeSubmission } from "./types/employeeWorkflow";

export function EmployeesPage() {
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Employee | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const deferredSearch = useDeferredValue(search);
  const { query, members, formerEmployees, saveEmployee, archiveEmployee } = useEmployees(deferredSearch);

  function save(submission: EmployeeSubmission) {
    saveEmployee.mutate({ employee: editing, submission }, { onSuccess: () => setFormOpen(false) });
  }

  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <PageHeader eyebrow="Employees" title="Employee records" description="Manage employment, cooperative membership links, client deployments, and beneficiary records." />
        <button className="focus-ring mb-6 inline-flex items-center justify-center gap-2 rounded bg-moss px-4 py-2.5 text-sm font-semibold text-white hover:bg-moss/90" onClick={() => { saveEmployee.reset(); setEditing(null); setFormOpen(true); }}><Plus className="h-4 w-4" /> New employee</button>
      </div>
      <section className="overflow-hidden rounded border border-line bg-white shadow-panel">
        <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><div className="relative w-full max-w-md"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/45" /><input className="focus-ring w-full rounded border border-line bg-paper/40 py-2.5 pl-9 pr-3 text-sm" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, employee number, or location" aria-label="Search employees" /></div><p className="text-xs text-ink/55">{query.data?.length ?? 0} records shown</p></div>
        {query.isError ? <div className="border-t border-line px-5 py-8 text-sm text-red-700">Unable to load employee records.</div> : <EmployeeTable employees={query.data ?? []} loading={query.isLoading} onEdit={(employee) => { saveEmployee.reset(); setEditing(employee); setFormOpen(true); }} onArchive={(employee) => { if (window.confirm(`Archive ${employee.first_name} ${employee.last_name}?`)) archiveEmployee.mutate(employee.id); }} />}
      </section>
      {formOpen ? <EmployeeForm employee={editing} members={members.data ?? []} formerEmployees={formerEmployees.data ?? []} saving={saveEmployee.isPending} saveError={saveEmployee.error?.message} onCancel={() => setFormOpen(false)} onSubmit={save} /> : null}
    </>
  );
}
