import { supabase } from "../../../database/supabase/client";
import type { DashboardMembershipStatus, DashboardSnapshot } from "../../../types/dashboard";
import type { DashboardRepository } from "../DashboardRepository";

type DashboardRpcResult = {
  total_members?: number;
  active_members?: number;
  pending_approvals?: number;
  total_employees?: number;
  active_employees?: number;
  client_deployed?: number;
  direct_employees?: number;
  membership_statuses?: Array<{ key: DashboardMembershipStatus["key"]; label: string; count: number }>;
  workforce_by_branch?: Array<{
    branch_id: string;
    branch_label: string;
    total: number;
    active: number;
    client_deployed: number;
    direct: number;
  }>;
};

function client() {
  if (!supabase) throw new Error("Supabase is not configured.");
  return supabase;
}

export class SupabaseDashboardRepository implements DashboardRepository {
  async getSnapshot(): Promise<DashboardSnapshot> {
    const { data, error } = await client().rpc("dashboard_snapshot");
    if (error) throw error;
    const result = (data ?? {}) as DashboardRpcResult;

    return {
      totalMembers: Number(result.total_members ?? 0),
      activeMembers: Number(result.active_members ?? 0),
      pendingApprovals: Number(result.pending_approvals ?? 0),
      totalEmployees: Number(result.total_employees ?? 0),
      activeEmployees: Number(result.active_employees ?? 0),
      clientDeployed: Number(result.client_deployed ?? 0),
      directEmployees: Number(result.direct_employees ?? 0),
      membershipStatuses: (result.membership_statuses ?? []).map((status) => ({
        ...status,
        count: Number(status.count),
      })),
      workforceByBranch: (result.workforce_by_branch ?? []).map((branch) => ({
        branchId: branch.branch_id,
        branchLabel: branch.branch_label,
        total: Number(branch.total),
        active: Number(branch.active),
        clientDeployed: Number(branch.client_deployed),
        direct: Number(branch.direct),
      })),
    };
  }
}
