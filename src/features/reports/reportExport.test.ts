import { Blob as NodeBlob } from "node:buffer";
import ExcelJS from "exceljs";
import { afterEach, expect, it, vi } from "vitest";
import { downloadReport } from "./reportExport";
import type { ReportRow } from "../../services/repositories/ReportRepository";

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it("exports payment amounts as numeric pesos with currency formatting", async () => {
  let file: NodeBlob | undefined;
  vi.stubGlobal("Blob", NodeBlob);
  vi.stubGlobal("URL", {
    createObjectURL(blob: NodeBlob) { file = blob; return "blob:report-test"; },
    revokeObjectURL: vi.fn(),
  });
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  await downloadReport("amounts", [{ branch: "Alpha", client: "Branch total", members: 3, paid: 1, unpaid: 2, amountCentavos: 650000, paidAmountCentavos: 550000, unpaidAmountCentavos: 100000, balanceCentavos: 1000000 } as ReportRow], "xlsx", []);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Buffer.from(await file!.arrayBuffer()) as unknown as Parameters<typeof workbook.xlsx.load>[0]);
  const sheet = workbook.worksheets[0];
  expect(sheet.getCell("C2").value).toBe(3);
  expect(sheet.getCell("F2").value).toBe(6500);
  expect(sheet.getCell("I2").value).toBe(10000);
  expect(sheet.getCell("F2").numFmt).toBe('"PHP "#,##0.00');
  await new Promise((resolve) => setTimeout(resolve, 1050));
});
