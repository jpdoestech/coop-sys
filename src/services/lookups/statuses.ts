export const MEMBER_STATUS = {
  active: "31000000-0000-4000-8000-000000000001",
  inactive: "31000000-0000-4000-8000-000000000002",
  terminated: "31000000-0000-4000-8000-000000000003",
  resigned: "31000000-0000-4000-8000-000000000004",
} as const;

export const EMPLOYMENT_STATUS = {
  active: "33000000-0000-4000-8000-000000000001",
  onLeave: "33000000-0000-4000-8000-000000000002",
  separated: "33000000-0000-4000-8000-000000000003",
  inactive: "33000000-0000-4000-8000-000000000004",
  retired: "33000000-0000-4000-8000-000000000005",
  resigned: "33000000-0000-4000-8000-000000000006",
  terminated: "33000000-0000-4000-8000-000000000007",
} as const;

export const terminalMemberStatuses = new Set<string>([
  MEMBER_STATUS.terminated,
  MEMBER_STATUS.resigned,
]);

export const terminalEmploymentStatuses = new Set<string>([
  EMPLOYMENT_STATUS.separated,
  EMPLOYMENT_STATUS.retired,
  EMPLOYMENT_STATUS.resigned,
  EMPLOYMENT_STATUS.terminated,
]);

