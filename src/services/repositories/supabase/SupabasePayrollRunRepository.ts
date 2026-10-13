import { supabase } from "../../../database/supabase/client";
import type { AccessProfile } from "../../access/accessControl";
import { assertPayrollAccess } from "../../payroll/payrollAccess";
import { validateRunInput } from "../../payroll/payrollRuns";
import type { PayrollRun, PayrollRunInput, PayrollRunQuery, RunCoverage } from "../../../types/payrollRun";
import type { PayrollRunRepository } from "../PayrollRunRepository";
function db() { if (!supabase) throw new Error("Supabase is not configured."); return supabase; }
export class SupabasePayrollRunRepository implements PayrollRunRepository {
  constructor(private profile: AccessProfile) {}
  async list(q: PayrollRunQuery) {
    assertPayrollAccess(this.profile);
    const { data, error } = await db().rpc("payroll_runs_page", { p_search: q.search || null, p_cancelled: Boolean(q.includeCancelled), p_limit: q.limit || 25, p_offset: q.offset || 0 });
    if (error) throw new Error(error.message); return data as { items: PayrollRun[]; total: number };
  }
  async create(input: PayrollRunInput) {
    assertPayrollAccess(this.profile, true); validateRunInput(input);
    const { data, error } = await db().rpc("create_payroll_run", { p_input: input });
    if (error) throw new Error(error.message); return data as PayrollRun;
  }
  async cancel(id: string, reason: string) {
    assertPayrollAccess(this.profile, true);
    const { error } = await db().rpc("cancel_payroll_run", { p_id: id, p_reason: reason }); if (error) throw new Error(error.message);
  }
  async coverage(id: string, limit = 25, offset = 0) {
    assertPayrollAccess(this.profile);
    const { data, error } = await db().rpc("payroll_run_coverage", { p_id: id, p_limit: limit, p_offset: offset });
    if (error) throw new Error(error.message); return data as RunCoverage;
  }
}
