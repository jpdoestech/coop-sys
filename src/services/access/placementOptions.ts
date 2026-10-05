import type { OrganizationBranch, OrganizationClient } from "../../types/organization";
import { isBranchScoped, type AccessProfile } from "./accessControl";

export function placementOptions(profile: AccessProfile, branches: OrganizationBranch[], clients: OrganizationClient[]) {
  if (!isBranchScoped(profile)) return { branches, clients };
  if (profile.scopeType === "self") return { branches: [], clients: [] };
  if (profile.scopeType === "assigned_clients") {
    const assignedClients = clients.filter((client) => profile.clientIds?.includes(client.id));
    const branchIds = new Set(assignedClients.map((client) => client.branchId));
    return { branches: branches.filter((branch) => branchIds.has(branch.id)), clients: assignedClients };
  }
  const assignedBranches = branches.filter((branch) => profile.branchIds.includes(branch.id));
  const branchIds = new Set(assignedBranches.map((branch) => branch.id));
  return { branches: assignedBranches, clients: clients.filter((client) => branchIds.has(client.branchId)) };
}
