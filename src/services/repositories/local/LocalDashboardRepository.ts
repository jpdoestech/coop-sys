import type { DashboardMembershipStatus, DashboardSnapshot } from "../../../types/dashboard";
import type { AccessProfile } from "../../access/accessControl";
import { branchIsInScope, employeeIsInScope, isBranchScoped } from "../../access/accessControl";
import { EMPLOYMENT_STATUS, MEMBER_STATUS } from "../../lookups/statuses";
import type { DashboardRepository } from "../DashboardRepository";
import { LocalEmployeeRepository } from "./LocalEmployeeRepository";
import { LocalMemberRepository } from "./LocalMemberRepository";
import { LocalOrganizationDirectoryRepository } from "./LocalOrganizationDirectoryRepository";

const membershipStatusDefinitions = [
  { key: "active", label: "Active", id: MEMBER_STATUS.active },
  { key: "inactive", label: "Inactive", id: MEMBER_STATUS.inactive },
  { key: "resigned", label: "Resigned", id: MEMBER_STATUS.resigned },
  { key: "terminated", label: "Terminated", id: MEMBER_STATUS.terminated },
] as const;

export class LocalDashboardRepository implements DashboardRepository {
  async getSnapshot(profile: AccessProfile): Promise<DashboardSnapshot> {
    const membersRepository = new LocalMemberRepository();
    const employeesRepository = new LocalEmployeeRepository();
    const organizationRepository = new LocalOrganizationDirectoryRepository();
    const [allMembers, allEmployees, directory] = await Promise.all([
      membersRepository.list(),
      employeesRepository.list(),
      organizationRepository.getDirectory(),
    ]);

    const employees = allEmployees.filter((employee) => employeeIsInScope(employee, profile));
    const visibleMemberIds = new Set(employees.map((employee) => employee.member_id).filter(Boolean));
    const members = isBranchScoped(profile)
      ? allMembers.filter((member) => visibleMemberIds.has(member.id))
      : allMembers;
    const activeEmployees = employees.filter(
      (employee) => employee.employment_status_id === EMPLOYMENT_STATUS.active,
    );

    const membershipStatuses: DashboardMembershipStatus[] = membershipStatusDefinitions.map(
      ({ key, label, id }) => ({
        key,
        label,
        count: members.filter((member) => member.membership_status_id === id).length,
      }),
    );

    const workforceByBranch = directory.branches
      .filter((branch) => branch.isActive && branchIsInScope(branch.id, profile))
      .map((branch) => {
        const branchEmployees = employees.filter(
          (employee) => employee.active_assignment?.branch_id === branch.id,
        );
        const branchActive = branchEmployees.filter(
          (employee) => employee.employment_status_id === EMPLOYMENT_STATUS.active,
        );
        return {
          branchId: branch.id,
          branchLabel: branch.label,
          total: branchEmployees.length,
          active: branchActive.length,
          clientDeployed: branchActive.filter((employee) => employee.active_assignment?.client_id).length,
          direct: branchActive.filter((employee) => !employee.active_assignment?.client_id).length,
        };
      })
      .filter((branch) => branch.total > 0)
      .sort((a, b) => b.active - a.active || a.branchLabel.localeCompare(b.branchLabel));

    return {
      totalMembers: members.length,
      activeMembers: membershipStatuses.find((status) => status.key === "active")?.count ?? 0,
      pendingApprovals: members.filter((member) => member.bod_approval_status === "pending").length,
      totalEmployees: employees.length,
      activeEmployees: activeEmployees.length,
      clientDeployed: activeEmployees.filter((employee) => employee.active_assignment?.client_id).length,
      directEmployees: activeEmployees.filter((employee) => !employee.active_assignment?.client_id).length,
      membershipStatuses,
      workforceByBranch,
    };
  }
}
