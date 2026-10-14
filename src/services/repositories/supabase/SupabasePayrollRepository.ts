import { supabase } from "../../../database/supabase/client";
import type { AccessProfile } from "../../access/accessControl";
import type { PayrollInput, PayrollRecord } from "../../../types/payroll";
import { assertPayrollAccess } from "../../payroll/payrollAccess";
import { validatePayrollInput, validPayrollDate } from "../../payroll/payrollSetup";
import type { PayrollQuery, PayrollRepository } from "../PayrollRepository";

function db() { if (!supabase) throw new Error("Supabase is not configured."); return supabase; }
export class SupabasePayrollRepository implements PayrollRepository {
  constructor(private profile: AccessProfile) {}
  async list(options: PayrollQuery) {
    assertPayrollAccess(this.profile);
    let query = db().from("payroll_setup_records").select("*", { count: "exact" }).eq("kind", options.kind).order("effective_from", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false });
    if (!options.includeArchived) query = query.is("deleted_at", null);
    if (options.asOf) query = query.lte("effective_from", options.asOf);
    if (options.search) query = query.ilike("data->>label", `%${options.search.replace(/[%,_]/g, " ")}%`);
    if (options.employeeId) query = query.eq("employee_id", options.employeeId);
    if (options.worksiteId) query = query.eq("worksite_id", options.worksiteId);
    if (options.branchId) query = query.eq("data->>branch_id", options.branchId);
    if (options.clientId !== undefined) query = options.clientId === null ? query.is("data->>client_id", null) : query.eq("data->>client_id", options.clientId);
    const { data, error, count } = await query.range(options.offset || 0, (options.offset || 0) + Math.min(100, options.limit || 25) - 1);
    if (error) throw new Error(error.message);
    return { items: (data || []) as PayrollRecord[], total: count || 0 };
  }
  async save(input: PayrollInput) {
    assertPayrollAccess(this.profile, true); validatePayrollInput(input);
    const { data, error } = await db().from("payroll_setup_records").insert({ kind: input.kind, data: input.data, created_by: this.profile.userId }).select("*").single();
    if (error) throw new Error(error.message); return data as PayrollRecord;
  }
  async archive(id: string) {
    assertPayrollAccess(this.profile, true);
    const { error } = await db().rpc("archive_payroll_setup", { p_id: id });
    if (error) throw new Error(error.message);
  }
  async saveBatch(inputs: PayrollInput[]) {
    assertPayrollAccess(this.profile, true);
    if (!inputs.length || inputs.length > 500) throw new Error("Select between 1 and 500 payroll records.");
    inputs.forEach(validatePayrollInput);
    const { data, error } = await db().rpc("save_payroll_setup_batch", { p_inputs: inputs });
    if (error) throw new Error(error.message);
    return (data || []) as PayrollRecord[];
  }
  async workDateRecords(employeeId: string, date: string) {
    assertPayrollAccess(this.profile);
    if (!validPayrollDate(date)) throw new Error("Enter a valid work date.");
    const { data, error } = await db().rpc("payroll_work_date_records", { p_employee_id: employeeId, p_date: date });
    if (error) throw new Error(error.message); return (data || []) as PayrollRecord[];
  }
}
