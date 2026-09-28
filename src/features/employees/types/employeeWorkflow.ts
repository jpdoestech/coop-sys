import type { EmployeeInput } from "../../../types/employee";

export type EmployeeMembershipChoice =
  | { mode: "none" }
  | { mode: "existing"; memberId: string }
  | { mode: "create"; membershipNumber: string };

export type EmployeeSubmission = {
  input: EmployeeInput;
  membership: EmployeeMembershipChoice;
};

