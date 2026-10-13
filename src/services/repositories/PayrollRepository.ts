import type { PayrollInput, PayrollKind, PayrollPage, PayrollRecord } from "../../types/payroll";
export type PayrollQuery = { kind: PayrollKind; search?: string; limit?: number; offset?: number; employeeId?: string; worksiteId?: string; asOf?: string; includeArchived?: boolean };
export interface PayrollRepository {
  list(query: PayrollQuery): Promise<PayrollPage>;
  save(input: PayrollInput): Promise<PayrollRecord>;
  archive(id: string): Promise<void>;
  workDateRecords(employeeId: string, date: string): Promise<PayrollRecord[]>;
}
