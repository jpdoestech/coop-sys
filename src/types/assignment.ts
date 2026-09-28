export type EmploymentAssignment = {
  id: string;
  branch_id: string | null;
  client_id: string | null;
  assignment_code: string | null;
  start_date: string;
  end_date: string | null;
  work_location: string | null;
  transfer_reason: string | null;
  notes: string | null;
};

export type EmploymentAssignmentInput = EmploymentAssignment;
