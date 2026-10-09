import { supabase } from "../../../database/supabase/client";
import type { AccessProfile } from "../../access/accessControl";
import { assertReportAccess, validateReportQuery } from "../../reports/reportCore";
import type { ReportPage, ReportQuery, ReportRepository } from "../ReportRepository";

export class SupabaseReportRepository implements ReportRepository {
  async listPage(raw: ReportQuery, profile: AccessProfile): Promise<ReportPage> {
    const query = validateReportQuery(raw); assertReportAccess(profile, query);
    if (!supabase) throw new Error("Supabase is not configured.");
    const { kind, limit, offset, sort, direction, exporting, ...filters } = query;
    const args = { p_filters: filters, p_limit: limit, p_offset: offset, p_sort: sort || (kind === "deployment" || kind === "amounts" ? "branch" : "name"), p_direction: direction, p_export: Boolean(exporting) };
    const { data, error } = kind === "amounts" ? await supabase.rpc("reports_amounts_page", args) : await supabase.rpc("reports_page", { ...args, p_kind: kind });
    if (error) throw new Error(error.message);
    return data as ReportPage;
  }
}
