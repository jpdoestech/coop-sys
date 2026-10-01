export type DashboardMembershipStatus = {
  key: "active" | "inactive" | "resigned" | "terminated";
  label: string;
  count: number;
};

export type DashboardBranchWorkforce = {
  branchId: string;
  branchLabel: string;
  total: number;
  active: number;
  clientDeployed: number;
  direct: number;
};

export type DashboardSnapshot = {
  totalMembers: number;
  activeMembers: number;
  pendingApprovals: number;
  totalEmployees: number;
  activeEmployees: number;
  clientDeployed: number;
  directEmployees: number;
  membershipStatuses: DashboardMembershipStatus[];
  workforceByBranch: DashboardBranchWorkforce[];
};
