import type { SystemUser, SystemUserInput } from "../../types/systemUser";

export type UserListOptions = {
  search?: string;
  status?: "active" | "inactive" | "all";
  limit?: number;
  offset?: number;
};

export interface UserAccessRepository {
  listPage(
    options?: UserListOptions,
  ): Promise<{ items: SystemUser[]; total: number }>;
  create(input: SystemUserInput): Promise<SystemUser>;
  update(id: string, input: SystemUserInput): Promise<SystemUser>;
}
