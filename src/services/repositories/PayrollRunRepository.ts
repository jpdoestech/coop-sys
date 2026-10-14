import type { PayrollRun, PayrollRunInput, PayrollRunQuery, RunCoverage } from "../../types/payrollRun";
import type { CalculationRule, CalculationRuleInput, CalculationSource } from "../../types/payrollCalculation";
export interface PayrollRunRepository {
  list(query: PayrollRunQuery): Promise<{ items: PayrollRun[]; total: number }>;
  create(input: PayrollRunInput): Promise<PayrollRun>;
  cancel(id: string, reason: string): Promise<void>;
  coverage(id: string, limit?: number, offset?: number): Promise<RunCoverage>;
  listRules(kind: "policy" | "calendar", site: string, limit?: number, offset?: number): Promise<{ items: CalculationRule[]; total: number }>;
  saveRules(inputs: CalculationRuleInput[]): Promise<void>;
  previewSource(id: string, limit?: number, offset?: number): Promise<CalculationSource>;
}
