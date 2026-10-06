import type { AccessProfile } from "../../access/accessControl";
import { assertReportAccess, validateReportQuery } from "../../reports/reportCore";
import { serverRequest } from "../../server/serverApi";
import type { ReportPage, ReportQuery, ReportRepository } from "../ReportRepository";

export class ServerReportRepository implements ReportRepository {
  async listPage(raw: ReportQuery, profile: AccessProfile): Promise<ReportPage> {
    const query = validateReportQuery(raw); assertReportAccess(profile, query);
    const params = new URLSearchParams(Object.entries(query).filter(([, value]) => value !== undefined).map(([key, value]) => [key, String(value)]));
    return serverRequest<ReportPage>(`/reports?${params}`);
  }
}
