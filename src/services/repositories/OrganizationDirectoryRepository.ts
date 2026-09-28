import type { OrganizationBranch, OrganizationClient, OrganizationDepartment, OrganizationDirectory, OrganizationPosition } from "../../types/organization";

export interface OrganizationDirectoryRepository {
  getDirectory(): Promise<OrganizationDirectory>;
  saveBranch(record: OrganizationBranch): Promise<void>;
  saveClient(record: OrganizationClient): Promise<void>;
  saveDepartment(record: OrganizationDepartment): Promise<void>;
  savePosition(record: OrganizationPosition): Promise<void>;
}
