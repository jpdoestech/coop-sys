import type { ReportKind, ReportRow } from "../../services/repositories/ReportRepository";
import { reportCell, reportColumns, reportTitles } from "../../services/reports/reportCore";

export function spreadsheetSafeText(value: string) {
  for (const character of value) {
    if (character.charCodeAt(0) <= 31 || character.trim() === "") continue;
    return "=+@-".includes(character) ? `'${value}` : value;
  }
  return value;
}
export function reportCsv(kind: ReportKind, rows: ReportRow[]) {
  const columns = reportColumns(kind);
  const escape = (value: string) => `"${spreadsheetSafeText(value).replaceAll('"', '""')}"`;
  return "\uFEFF" + [columns.map((column) => escape(column.label)).join(","), ...rows.map((row) => columns.map((column) => escape(reportCell(row, column.key, kind))).join(","))].join("\r\n");
}
export async function downloadReport(kind: ReportKind, rows: ReportRow[], format: "csv" | "xlsx", metadata: string[]) {
  let blob: Blob;
  if (format === "csv") blob = new Blob([reportCsv(kind, rows)], { type: "text/csv;charset=utf-8" });
  else {
    const { default: ExcelJS } = await import("exceljs");
    const workbook = new ExcelJS.Workbook(); workbook.creator = "Records Desk";
    const sheet = workbook.addWorksheet(reportTitles[kind].slice(0, 31), { views: [{ state: "frozen", ySplit: 1 }] });
    const columns = reportColumns(kind);
    sheet.columns = columns.map((column) => ({ header: column.label, key: column.key, width: column.key === "name" ? 32 : ["branch", "client", "department", "position"].includes(column.key) ? 27 : 18 }));
    rows.forEach((row) => sheet.addRow(Object.fromEntries(columns.map((column) => [column.key, column.numeric ? Number(row[column.key]) : spreadsheetSafeText(reportCell(row, column.key, kind))]))));
    sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF247253" } }; sheet.getRow(1).height = 24;
    sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: rows.length + 1, column: columns.length } };
    columns.forEach((column, index) => { if (!column.numeric) sheet.getColumn(index + 1).numFmt = "@"; });
    const scope = workbook.addWorksheet("Report Filters"); scope.getColumn(1).width = 100;
    scope.addRows([[reportTitles[kind]], ...metadata.map((text) => [spreadsheetSafeText(text)])]);
    const bytes = await workbook.xlsx.writeBuffer(); blob = new Blob([new Uint8Array(bytes)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  }
  const url = URL.createObjectURL(blob), anchor = document.createElement("a");
  anchor.href = url; anchor.download = `${kind}_report_${new Date().toISOString().slice(0, 10)}.${format}`; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
