import { createContext } from "react";
import type { OrganizationBranch, OrganizationClient, OrganizationDepartment, OrganizationDirectory, OrganizationPosition } from "../../types/organization";

export type OrganizationContextState = OrganizationDirectory & {
  loading: boolean;
  error: string | null;
  saveBranch: (record: OrganizationBranch) => Promise<void>;
  saveClient: (record: OrganizationClient) => Promise<void>;
  saveDepartment: (record: OrganizationDepartment) => Promise<void>;
  savePosition: (record: OrganizationPosition) => Promise<void>;
};

export const OrganizationContextValue = createContext<OrganizationContextState | null>(null);
