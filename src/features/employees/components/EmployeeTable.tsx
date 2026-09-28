import { Archive, Pencil, UserRoundCog } from "lucide-react";
import type { Employee } from "../../../types/employee";
import { activeBeneficiaryCount } from "../../../types/beneficiary";
import { employmentStatuses, labelFor } from "../data/employeeOptions";
import { useOrganization } from "../../../services/organization/useOrganization";

function placementFor(employee: Employee, branches: Array<{ id: string; label: string }>, clients: Array<{ id: string; label: string }>) {
  const assignment = employee.active_assignment;
  if (!assignment) return { primary: "No active placement", secondary: "Assignment closed" };
  const branch = labelFor(branches, assignment.branch_id);
  const client = clients.find((item) => item.id === assignment.client_id)?.label;
  return {
    primary: client ?? branch,
    secondary: client ? branch : assignment.assignment_code ?? "Direct employee",
  };
}

type Props = {
  employees: Employee[];
  loading: boolean;
  onEdit: (employee: Employee) => void;
  onArchive: (employee: Employee) => void;
  canManage: boolean;
};

export function EmployeeTable({ employees, loading, onEdit, onArchive, canManage }: Props) {
  const { branches, clients, departments, positions } = useOrganization();
  if (loading) return <div className="border-t border-line px-5 py-12 text-center text-sm text-ink/60">Loading employee records...</div>;
  if (!employees.length) return <div className="border-t border-line px-5 py-14 text-center"><UserRoundCog className="mx-auto h-7 w-7 text-moss" /><p className="mt-3 text-sm font-semibold">No matching employees</p></div>;

  return (
    <div className="max-h-[60vh] overflow-auto border-t border-line">
      <table className="w-full min-w-[980px] border-collapse text-left text-sm">
        <thead className="sticky top-0 z-10"><tr className="bg-ink text-xs uppercase text-white">
          <th className="px-5 py-3">Employee</th><th className="px-4 py-3">Role</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Placement</th><th className="px-4 py-3">Beneficiaries</th><th className="px-4 py-3">Member</th>{canManage ? <th className="w-24 px-4 py-3 text-right">Actions</th> : null}
        </tr></thead>
        <tbody className="divide-y divide-line bg-white">
          {employees.map((employee) => {
            const placement = placementFor(employee, branches, clients);
            return <tr key={employee.id} className="hover:bg-paper/70">
              <td className="px-5 py-3.5"><p className="font-semibold">{employee.last_name}, {employee.first_name}</p><p className="mt-0.5 font-mono text-xs text-ink/55">{employee.employee_number}</p></td>
              <td className="px-4 py-3.5"><p>{labelFor(positions, employee.position_id)}</p><p className="mt-0.5 text-xs text-ink/55">{labelFor(departments, employee.department_id)}</p></td>
              <td className="px-4 py-3.5"><span className="inline-flex items-center gap-1.5"><span className={`h-2 w-2 rounded-full ${employee.employment_status_id === employmentStatuses[0].id ? "bg-emerald-500" : "bg-amber-500"}`} />{labelFor(employmentStatuses, employee.employment_status_id)}</span></td>
              <td className="px-4 py-3.5"><p>{placement.primary}</p><p className="mt-0.5 text-xs text-ink/55">{placement.secondary}</p></td>
              <td className="px-4 py-3.5">{activeBeneficiaryCount(employee.beneficiaries)} / 3</td>
              <td className="px-4 py-3.5">{employee.member_id ? <span className="font-semibold text-moss">Linked</span> : <span className="text-ink/50">Not a member</span>}</td>
              {canManage ? <td className="px-4 py-3.5"><div className="flex justify-end gap-1">
                <button className="focus-ring rounded p-2 text-ink/65 hover:bg-paper hover:text-moss" onClick={() => onEdit(employee)} title="Edit employee" aria-label={`Edit ${employee.first_name} ${employee.last_name}`}><Pencil className="h-4 w-4" /></button>
                <button className="focus-ring rounded p-2 text-ink/65 hover:bg-red-50 hover:text-red-700" onClick={() => onArchive(employee)} title="Archive employee" aria-label={`Archive ${employee.first_name} ${employee.last_name}`}><Archive className="h-4 w-4" /></button>
              </div></td> : null}
            </tr>;
          })}
        </tbody>
      </table>
    </div>
  );
}
