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
