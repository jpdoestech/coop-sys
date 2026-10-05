import { useState } from "react";
import type { OrganizationBranch, OrganizationClient } from "../../types/organization";

export function usePlacementSelection(branches: OrganizationBranch[], clients: OrganizationClient[]) {
  const [selectedBranchId, setSelectedBranchId] = useState("");
  const [selectedClientId, setClientId] = useState<string | null>(null);
  const branchId = branches.some((branch) => branch.id === selectedBranchId)
    ? selectedBranchId
    : branches.length === 1 ? branches[0].id : "";
  const availableClients = clients.filter((client) => client.branchId === branchId);
  const clientId = selectedClientId !== null && (selectedClientId === "" || availableClients.some((client) => client.id === selectedClientId))
    ? selectedClientId
    : availableClients.length === 1 ? availableClients[0].id : "";

  function setBranchId(value: string) {
    setSelectedBranchId(value);
    setClientId(null);
  }

  return { branchId, clientId, setBranchId, setClientId, availableClients, fixedBranch: branches.length === 1, fixedClient: availableClients.length === 1 };
}
