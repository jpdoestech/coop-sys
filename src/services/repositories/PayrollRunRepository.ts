import type { PayrollRun, PayrollRunInput, PayrollRunQuery, RunCoverage } from "../../types/payrollRun";
export interface PayrollRunRepository {
  list(query: PayrollRunQuery): Promise<{ items: PayrollRun[]; total: number }>;
  create(input: PayrollRunInput): Promise<PayrollRun>;
  cancel(id: string, reason: string): Promise<void>;
  coverage(id: string, limit?: number, offset?: number): Promise<RunCoverage>;
}
