import type { Employee } from "../../types/employee";
import type { MemberInput } from "../../types/member";
import type { EmploymentAssignmentInput } from "../../types/assignment";
import type { EmployeeRepository } from "../repositories/EmployeeRepository";
import { createUuid } from "../../utils/createUuid";

export async function applyMemberPlacement(repository: EmployeeRepository, employee: Employee, input: MemberInput, transfer?: { effectiveDate: string; reason: string; workLocation: string | null }) {
  const current = employee.active_assignment;
  if (current && current.branch_id === input.proposed_branch_id && current.client_id === input.proposed_client_id) return;
  if (!current && employee.assignment_history.length) {
    if (input.proposed_branch_id) throw new Error("This employee's assignment has ended. Use the re-employment workflow before assigning a new deployment.");
    return;
  }
  if (!input.proposed_branch_id) throw new Error("Select the intended deployment branch.");
  if (current && !transfer) throw new Error("Enter an effective date and reason for the employee transfer.");
  const assignment: EmploymentAssignmentInput = {
    id: createUuid(), branch_id: input.proposed_branch_id, client_id: input.proposed_client_id,
    assignment_code: current?.assignment_code || null, start_date: transfer?.effectiveDate || employee.date_hired || new Date().toISOString().slice(0, 10),
    end_date: null, work_location: transfer?.workLocation || employee.work_location,
    transfer_reason: transfer?.reason || "Initial deployment from member record", notes: "Deployment initiated from the linked member record",
  };
  if (current) await repository.transfer(employee.id, assignment, "member");
  else await repository.update(employee.id, { active_assignment: assignment, work_location: assignment.work_location });
}
