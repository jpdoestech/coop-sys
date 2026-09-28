import { EMPLOYMENT_STATUS } from "../../../services/lookups/statuses";

export const employmentStatuses = [
  { id: EMPLOYMENT_STATUS.active, label: "Active" },
  { id: EMPLOYMENT_STATUS.onLeave, label: "On Leave" },
  { id: EMPLOYMENT_STATUS.separated, label: "Separated" },
  { id: EMPLOYMENT_STATUS.inactive, label: "Inactive" },
  { id: EMPLOYMENT_STATUS.retired, label: "Retired" },
  { id: EMPLOYMENT_STATUS.resigned, label: "Resigned" },
  { id: EMPLOYMENT_STATUS.terminated, label: "Terminated" }
] as const;

export const employmentTypes = [
  { id: "32000000-0000-4000-8000-000000000001", label: "Regular" },
  { id: "32000000-0000-4000-8000-000000000002", label: "Probationary" },
  { id: "32000000-0000-4000-8000-000000000003", label: "Contractual" },
  { id: "32000000-0000-4000-8000-000000000004", label: "Part-time" },
  { id: "32000000-0000-4000-8000-000000000005", label: "Temporary" },
  { id: "32000000-0000-4000-8000-000000000006", label: "Other" }
] as const;

export const departments = [
  { id: "10000000-0000-4000-8000-000000000001", label: "Administration" },
  { id: "10000000-0000-4000-8000-000000000002", label: "Finance" },
  { id: "10000000-0000-4000-8000-000000000003", label: "Membership Services" },
  { id: "10000000-0000-4000-8000-000000000004", label: "Operations" },
  { id: "10000000-0000-4000-8000-000000000005", label: "Information Technology" }
] as const;

export const positions = [
  { id: "20000000-0000-4000-8000-000000000001", departmentId: departments[0].id, label: "General Manager" },
  { id: "20000000-0000-4000-8000-000000000002", departmentId: departments[0].id, label: "Administrative Officer" },
  { id: "20000000-0000-4000-8000-000000000003", departmentId: departments[1].id, label: "Finance Manager" },
  { id: "20000000-0000-4000-8000-000000000004", departmentId: departments[1].id, label: "Bookkeeper" },
  { id: "20000000-0000-4000-8000-000000000005", departmentId: departments[2].id, label: "Membership Officer" },
  { id: "20000000-0000-4000-8000-000000000006", departmentId: departments[2].id, label: "Member Services Associate" },
  { id: "20000000-0000-4000-8000-000000000007", departmentId: departments[3].id, label: "Operations Manager" },
  { id: "20000000-0000-4000-8000-000000000008", departmentId: departments[3].id, label: "Operations Associate" },
  { id: "20000000-0000-4000-8000-000000000009", departmentId: departments[4].id, label: "Systems Administrator" },
  { id: "20000000-0000-4000-8000-000000000010", departmentId: departments[4].id, label: "Technical Support Specialist" }
] as const;

export const branches = [
  { id: "60000000-0000-4000-8000-000000000001", label: "Davao Branch" },
  { id: "60000000-0000-4000-8000-000000000002", label: "General Santos Branch" }
] as const;

export const clients = [
  { id: "61000000-0000-4000-8000-000000000001", label: "Fictional Manufacturing Client" },
  { id: "61000000-0000-4000-8000-000000000002", label: "Fictional Logistics Client" }
] as const;

export function labelFor(options: ReadonlyArray<{ id: string; label: string }>, id: string | null) {
  return options.find((option) => option.id === id)?.label ?? "Not set";
}
