import type {
  OrganizationBranch,
  OrganizationClient,
  OrganizationDepartment,
  OrganizationDirectory,
  OrganizationPosition,
} from "../../types/organization";

export type OrganizationRecordKind =
  | "branch"
  | "client"
  | "department"
  | "position";
export type OrganizationRecord =
  | OrganizationBranch
  | OrganizationClient
  | OrganizationDepartment
  | OrganizationPosition;
export type OrganizationListOptions = {
  search?: string;
  status?: "active" | "inactive" | "all";
  limit?: number;
  offset?: number;
};

export interface OrganizationDirectoryRepository {
  getDirectory(): Promise<OrganizationDirectory>;
  listRecords(
    kind: OrganizationRecordKind,
    options?: OrganizationListOptions,
  ): Promise<{ items: OrganizationRecord[]; total: number }>;
  saveBranch(record: OrganizationBranch): Promise<void>;
  saveClient(record: OrganizationClient): Promise<void>;
  saveDepartment(record: OrganizationDepartment): Promise<void>;
  savePosition(record: OrganizationPosition): Promise<void>;
}
