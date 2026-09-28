export const branches = [
  { id: "60000000-0000-4000-8000-000000000000", label: "Head Office", type: "head_office", parentId: null },
  { id: "60000000-0000-4000-8000-000000000001", label: "Davao Branch", type: "branch", parentId: "60000000-0000-4000-8000-000000000000" },
  { id: "60000000-0000-4000-8000-000000000002", label: "General Santos Branch", type: "branch", parentId: "60000000-0000-4000-8000-000000000000" },
] as const;

export const clients = [
  { id: "61000000-0000-4000-8000-000000000001", label: "Fictional Manufacturing Client", branchId: branches[1].id },
  { id: "61000000-0000-4000-8000-000000000002", label: "Fictional Logistics Client", branchId: branches[2].id },
] as const;

export const HEAD_OFFICE_ID = branches[0].id;

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

