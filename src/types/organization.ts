import type { BaseRecord } from "./common";

export type Department = BaseRecord & {
  department_code: string;
  department_name: string;
  description: string | null;
  department_head_id: string | null;
  is_active: boolean;
};

export type Position = BaseRecord & {
  position_code: string;
  position_title: string;
  department_id: string | null;
  description: string | null;
  is_active: boolean;
};

export type OrganizationBranch = {
  id: string;
  code: string;
  label: string;
  address: string;
  type: "head_office" | "branch";
  parentId: string | null;
  isActive: boolean;
};

export type OrganizationClient = {
  id: string;
  code: string;
  label: string;
  branchId: string;
  address: string;
  contactPerson: string;
  contactDetails: string;
  isActive: boolean;
};

export type OrganizationDepartment = {
  id: string;
  code: string;
  label: string;
  description: string;
  isActive: boolean;
};

export type OrganizationPosition = {
  id: string;
  code: string;
  label: string;
  departmentId: string;
  description: string;
  isActive: boolean;
};

export type OrganizationDirectory = {
  branches: OrganizationBranch[];
  clients: OrganizationClient[];
  departments: OrganizationDepartment[];
  positions: OrganizationPosition[];
};
