import { describe, expect, it, vi } from "vitest";
import type { AccessProfile } from "../access/accessControl";
import { assertReportAccess, canExportReport, collectReportRows, emptyReport, validateReportQuery } from "./reportCore";
import { reportCsv, spreadsheetSafeText } from "../../features/reports/reportExport";
import type { ReportRow } from "../repositories/ReportRepository";

const reader: AccessProfile = { userId: "reader", displayName: "Reader", role: "custom", branchIds: [], effectivePermissions: ["reports.view", "reports.export", "employees.view"] };
describe("report access and query contracts", () => {
  it("requires both report and source permissions, including export permission", () => {
    expect(() => assertReportAccess(reader, { kind: "employees" })).not.toThrow();
    expect(() => assertReportAccess(reader, { kind: "members" })).toThrow();
    expect(canExportReport(reader, "employees")).toBe(false);
    expect(() => assertReportAccess(reader, { kind: "employees", exporting: true })).toThrow();
    expect(canExportReport({ ...reader, effectivePermissions: [...reader.effectivePermissions!, "employees.export"] }, "deployment")).toBe(true);
  });
  it("validates date ranges and caps database pages", () => {
    expect(() => validateReportQuery({ kind: "employees", dateFrom: "2026-02-30" })).toThrow();
    expect(() => validateReportQuery({ kind: "members", dateFrom: "2026-02-01", dateTo: "2026-01-01" })).toThrow();
    expect(validateReportQuery({ kind: "members", limit: 5000, offset: -10 })).toMatchObject({ limit: 500, offset: 0 });
    expect(validateReportQuery({ kind: "members", limit: Infinity, offset: NaN })).toMatchObject({ limit: 25, offset: 0 });
  });
  it("exports all filtered pages, not just the displayed page", async () => {
    const rows = Array.from({ length: 501 }, (_, i) => ({ id: String(i) } as ReportRow));
    const load = vi.fn(async (query) => ({ ...emptyReport, total: rows.length, items: rows.slice(query.offset, query.offset + query.limit) }));
    expect(await collectReportRows(load, { kind: "employees", offset: 25, limit: 25 })).toHaveLength(501);
    expect(load).toHaveBeenNthCalledWith(2, expect.objectContaining({ offset: 500, limit: 500, exporting: true }));
  });
  it("escapes CSV formulas and preserves six-digit IDs", () => {
    expect(spreadsheetSafeText(" \t=HYPERLINK(\"bad\")")).toMatch(/^'/);
    const csv = reportCsv("members", [{ number: "000019", name: '=HYPERLINK("bad")', statusId: "", typeId: "", approval: "pending", attention: true } as ReportRow]);
    expect(csv).toContain('"000019"'); expect(csv).toContain('"\'=HYPERLINK(""bad"")"');
    expect(csv).not.toContain("sss_number");
  });
  it("rejects oversized exports before collecting rows", async () => {
    await expect(collectReportRows(async () => ({ ...emptyReport, total: 50001 }), { kind: "members" })).rejects.toThrow("50,000");
  });
});
