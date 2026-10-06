import { supabase } from "../../../database/supabase/client";
import type { AccessProfile } from "../../access/accessControl";
import { assertReportAccess, validateReportQuery } from "../../reports/reportCore";
import type { ReportPage, ReportQuery, ReportRepository } from "../ReportRepository";

export class SupabaseReportRepository implements ReportRepository {
  async listPage(raw: ReportQuery, profile: AccessProfile): Promise<ReportPage> {
    const query = validateReportQuery(raw); assertReportAccess(profile, query);
    if (!supabase) throw new Error("Supabase is not configured.");
    const { kind, limit, offset, sort, direction, exporting, ...filters } = query;
    const { data, error } = await supabase.rpc("reports_page", { p_kind: kind, p_filters: filters, p_limit: limit, p_offset: offset, p_sort: sort || (kind === "deployment" ? "branch" : "name"), p_direction: direction, p_export: Boolean(exporting) });
    if (error) throw new Error(error.message);
    return data as ReportPage;
  }
}
