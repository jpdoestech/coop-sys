import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { OrganizationBranch, OrganizationClient } from "../../types/organization";
import { usePlacementSelection } from "./usePlacementSelection";

const branches = [{ id: "branch-1" }, { id: "branch-2" }] as OrganizationBranch[];
const clients = [{ id: "client-1", branchId: "branch-1" }, { id: "client-2", branchId: "branch-2" }, { id: "client-3", branchId: "branch-2" }] as OrganizationClient[];

describe("import placement selection", () => {
  it("automatically selects the sole branch and client, including when options arrive later", () => {
    const { result, rerender } = renderHook(({ availableBranches, availableClients }) => usePlacementSelection(availableBranches, availableClients), {
      initialProps: { availableBranches: [] as OrganizationBranch[], availableClients: [] as OrganizationClient[] },
    });
    expect(result.current.branchId).toBe("");
    rerender({ availableBranches: [branches[0]], availableClients: [clients[0]] });
    expect(result.current).toMatchObject({ branchId: "branch-1", clientId: "client-1", fixedBranch: true, fixedClient: true });
  });

  it("requires a choice for multiple options and resets client when the branch changes", () => {
    const { result } = renderHook(() => usePlacementSelection(branches, clients));
    expect(result.current.branchId).toBe("");
    act(() => result.current.setBranchId("branch-1"));
    expect(result.current.clientId).toBe("client-1");
    act(() => result.current.setBranchId("branch-2"));
    expect(result.current.clientId).toBe("");
    expect(result.current.availableClients.map((client) => client.id)).toEqual(["client-2", "client-3"]);
  });

  it("preserves explicit no-client selection for existing direct employee transactions", () => {
    const { result } = renderHook(() => usePlacementSelection([branches[0]], [clients[0]]));
    act(() => result.current.setClientId(""));
    expect(result.current.clientId).toBe("");
  });
});
