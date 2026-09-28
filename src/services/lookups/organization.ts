import type { OrganizationDirectory } from "../../types/organization";

export const branches: OrganizationDirectory["branches"] = [
  { id: "60000000-0000-4000-8000-000000000000", code: "HO", label: "Head Office", address: "Main Office", type: "head_office", parentId: null, isActive: true },
  { id: "60000000-0000-4000-8000-000000000001", code: "DVO", label: "Davao Branch", address: "Davao City", type: "branch", parentId: "60000000-0000-4000-8000-000000000000", isActive: true },
  { id: "60000000-0000-4000-8000-000000000002", code: "GES", label: "General Santos Branch", address: "General Santos City", type: "branch", parentId: "60000000-0000-4000-8000-000000000000", isActive: true },
];

export const clients: OrganizationDirectory["clients"] = [
  { id: "61000000-0000-4000-8000-000000000001", code: "CLIENT-A", label: "Fictional Manufacturing Client", branchId: branches[1].id, address: "Davao City", contactPerson: "", contactDetails: "", isActive: true },
  { id: "61000000-0000-4000-8000-000000000002", code: "CLIENT-B", label: "Fictional Logistics Client", branchId: branches[2].id, address: "General Santos City", contactPerson: "", contactDetails: "", isActive: true },
];

export const HEAD_OFFICE_ID = branches[0].id;

export function replaceOrganizationLookups(directory: Pick<OrganizationDirectory, "branches" | "clients">) {
  branches.splice(0, branches.length, ...directory.branches);
  clients.splice(0, clients.length, ...directory.clients);
}

export function clientsForBranch(branchId: string | null) {
  return clients.filter((client) => client.branchId === branchId);
}

export function isValidPlacement(branchId: string | null, clientId: string | null) {
  if (!branchId) return !clientId;
  const branch = branches.find((item) => item.id === branchId);
  if (!branch) return false;
  if (branch.type === "head_office") return !clientId;
  return !clientId || clients.some((client) => client.id === clientId && client.branchId === branchId);
}

