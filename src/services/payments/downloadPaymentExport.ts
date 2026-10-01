import { strToU8, zipSync } from "fflate";
import type { PaymentExportData, PaymentExportSheet } from "./paymentExport";

const accountingFormat = '_-* #,##0.00_-;\\-* #,##0.00_-;_-* "-"??_-;_-@_-';

function triggerDownload(data: BlobPart, type: string, fileName: string) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function csvCell(value: string | number | null) {
  if (value === null) return "";
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function sheetCsv(sheet: PaymentExportSheet) {
  return `\uFEFF${[sheet.headers, ...sheet.rows].map((row) => row.map(csvCell).join(",")).join("\r\n")}`;
}

export async function createPaymentExcelBuffer(data: PaymentExportData) {
  const { Workbook } = await import("exceljs");
  const workbook = new Workbook();
  workbook.creator = "Cooperative Records Desk";
  workbook.created = new Date();

  for (const source of data.sheets) {
    const sheet = workbook.addWorksheet(source.name, { views: [{ state: "frozen", xSplit: source.freezeColumns, ySplit: 1 }] });
    sheet.addRow(source.headers);
    source.rows.forEach((row) => sheet.addRow(row));
    source.comments?.forEach((comment) => { sheet.getCell(comment.rowIndex + 2, comment.columnIndex + 1).note = comment.text; });
    sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: source.headers.length } };
    sheet.getRow(1).font = { name: "Calibri", size: 11, bold: true };
    sheet.getColumn(1).numFmt = "@";
    sheet.getColumn(1).width = 10.89;
    sheet.getColumn(2).width = 22.66;
    sheet.getColumn(3).width = source.name === "PAYMENT_MONTHLY" ? 8.66 : source.name === "PAYMENT_PERIOD" ? 9.55 : 11.33;

    const statusIndex = source.headers.indexOf("STATUS") + 1;
    const refundIndex = source.headers.indexOf("REFUND") + 1;
    for (let column = source.name === "PAYMENT_YEARLY" ? 3 : 4; column < statusIndex; column += 1) {
      sheet.getColumn(column).numFmt = accountingFormat;
      sheet.getColumn(column).alignment = { horizontal: "center" };
    }
    sheet.getColumn(statusIndex).alignment = { horizontal: "center" };
    if (refundIndex) { sheet.getColumn(refundIndex).numFmt = accountingFormat; sheet.getColumn(refundIndex).width = 12; }
    sheet.getColumn(statusIndex).width = 12;
    sheet.getColumn(statusIndex + 1).width = 13.78;
    sheet.getColumn(statusIndex + 2).width = 11.33;
    source.rows.forEach((row, rowIndex) => {
      const dateValue = row[row.length - 1];
      if (typeof dateValue === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
        sheet.getCell(rowIndex + 2, row.length).value = new Date(`${dateValue}T00:00:00`);
        sheet.getCell(rowIndex + 2, row.length).numFmt = "mm/dd/yyyy";
      }
    });
  }

  return workbook.xlsx.writeBuffer();
}

export async function downloadPaymentExcel(data: PaymentExportData, baseName: string) {
  const buffer = await createPaymentExcelBuffer(data);
  triggerDownload(buffer, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", `${baseName}.xlsx`);
}

export function downloadPaymentCsv(data: PaymentExportData, baseName: string) {
  if (data.sheets.length === 1) {
    triggerDownload(sheetCsv(data.sheets[0]), "text/csv;charset=utf-8", `${baseName}_${data.sheets[0].name}.csv`);
    return;
  }
  const files = Object.fromEntries(data.sheets.map((sheet) => [`${sheet.name}.csv`, strToU8(sheetCsv(sheet))]));
  triggerDownload(zipSync(files), "application/zip", `${baseName}_CSV.zip`);
}
