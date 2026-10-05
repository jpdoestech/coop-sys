import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { createPersonImportTemplate, personImportHeaders } from "./personImportTemplate";
import { departments, positions } from "../../features/employees/data/employeeOptions";

describe("person import templates", () => {
  it.each(["employee", "member"] as const)("includes every supported %s column, reference lists and frozen identity columns", async (kind) => {
    const buffer = await createPersonImportTemplate(kind, { departments, positions });
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const sheet = workbook.worksheets[0];
    expect((sheet.getRow(1).values as string[]).slice(1)).toEqual(personImportHeaders(kind));
    expect(sheet.views[0]).toMatchObject({ state: "frozen", xSplit: 4, ySplit: 1 });
    expect(workbook.getWorksheet("LOOKUPS")).toBeDefined();
    expect(workbook.getWorksheet("IMPORT GUIDE")).toBeDefined();
    expect(sheet.getColumn(personImportHeaders(kind).indexOf("ID") + 1).numFmt).toBe("@");
    expect(personImportHeaders(kind)).toContain("BENEFICIARY 3 DEACTIVATION REASON");
    expect(personImportHeaders(kind)).not.toContain("BARANGAY");
  });
});
