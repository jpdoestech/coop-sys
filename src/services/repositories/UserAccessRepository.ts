import type { SystemUser, SystemUserInput } from "../../types/systemUser";

export interface UserAccessRepository {
  list(): Promise<SystemUser[]>;
  create(input: SystemUserInput): Promise<SystemUser>;
  update(id: string, input: SystemUserInput): Promise<SystemUser>;
}

