import type { PaymentImportRow } from "../../types/payment";
import { pesosToCentavos } from "../payments/paymentMath";
import { spreadsheetDate } from "./spreadsheetDate";

export type SpreadsheetRow = Record<string, string>;

const MAX_FILE_BYTES = 8 * 1024 * 1024;
const MAX_ROWS = 5000;

function cellText(value: unknown) {
  if (value === null || value === undefined) return "";
  if (typeof value === "object" && value && "text" in value) return String((value as { text: unknown }).text ?? "").trim();
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? "Invalid date" : value.toISOString().slice(0, 10);
  return String(value).trim();
}

export async function readSpreadsheet(file: File): Promise<SpreadsheetRow[]> {
  if (!/\.(xlsx|xlsm)$/i.test(file.name)) throw new Error("Select an Excel .xlsx or .xlsm file.");
  if (file.size > MAX_FILE_BYTES) throw new Error("Excel file must not exceed 8 MB.");
  const { readSheet } = await import("read-excel-file/browser");
  const { unzipSync, strFromU8 } = await import("fflate");
  const zip = unzipSync(new Uint8Array(await file.arrayBuffer()), { filter: (entry) => entry.name === "xl/workbook.xml" });
  const workbook = zip["xl/workbook.xml"] ? strFromU8(zip["xl/workbook.xml"]) : "";
  const date1904 = /\bdate1904\s*=\s*["'](?:1|true)["']/i.test(workbook);
  const values = await readSheet(file);
  return spreadsheetRowsFromCells(values, date1904);
}

export function spreadsheetRowsFromCells(values: unknown[][], date1904 = false): SpreadsheetRow[] {
  if (!values.length) throw new Error("The workbook does not contain a worksheet.");
  const headers = values[0].map((value) => cellText(value).toUpperCase().replace(/\s+/g, " "));
  if (!headers.some(Boolean)) throw new Error("The first row must contain column headers.");
  if (new Set(headers.filter(Boolean)).size !== headers.filter(Boolean).length) throw new Error("The worksheet contains duplicate column headers.");
  const rows: SpreadsheetRow[] = [];
  values.slice(1, MAX_ROWS + 1).forEach((row) => {
    const record = Object.fromEntries(headers.filter(Boolean).map((header) => {
      const value = row[headers.indexOf(header)];
      let text = cellText(value);
      if (header.includes("DATE")) text = spreadsheetDate(value, date1904) ?? text;
      if (header === "MOBILE" && typeof value === "number" && /^9\d{9}$/.test(text)) text = `0${text}`;
      return [header, text];
    }));
    if (Object.values(record).some(Boolean)) rows.push(record);
  });
  if (!rows.length) throw new Error("The worksheet does not contain data rows.");
  if (values.length - 1 > MAX_ROWS) throw new Error(`A maximum of ${MAX_ROWS} rows can be imported at once.`);
  return rows;
}

export function paymentRowsFromSpreadsheet(rows: SpreadsheetRow[]): PaymentImportRow[] {
  const missing = ["NAME", "AMOUNT"].filter((header) => !(header in rows[0]));
  if (missing.length) throw new Error(`Missing required header${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}.`);
  return rows.map((row, index) => {
    if (!row.NAME) throw new Error(`Row ${index + 2}: NAME is required.`);
    let amountCentavos: number;
    try { amountCentavos = pesosToCentavos(row.AMOUNT); }
    catch { throw new Error(`Row ${index + 2}: AMOUNT must be a positive number.`); }
    return { rowNumber: index + 2, id: row.ID ?? "", name: row.NAME, amountCentavos, remarks: row.REMARKS ?? "" };
  });
}

export type AliasImportRow = { rowNumber: number; id: string; name: string; alias: string };

export function aliasRowsFromSpreadsheet(rows: SpreadsheetRow[]): AliasImportRow[] {
  if (!("ALIAS" in rows[0])) throw new Error("Missing required header: ALIAS.");
  return rows.map((row, index) => {
    if (!row.ID && !row.NAME) throw new Error(`Row ${index + 2}: ID or NAME is required.`);
    if (!row.ALIAS) throw new Error(`Row ${index + 2}: ALIAS is required.`);
    return { rowNumber: index + 2, id: row.ID ?? "", name: row.NAME ?? "", alias: row.ALIAS };
  });
}
