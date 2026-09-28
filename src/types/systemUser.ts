import type { RoleCode } from "../services/access/accessControl";

export type SystemUser = {
  id: string;
  display_name: string;
  email: string;
  role: RoleCode;
  branch_ids: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type SystemUserInput = Omit<SystemUser, "id" | "created_at" | "updated_at">;

