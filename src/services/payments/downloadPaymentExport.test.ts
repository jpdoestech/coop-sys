import { describe, expect, it } from "vitest";
import { Workbook } from "exceljs";
import { createPaymentExcelBuffer } from "./downloadPaymentExport";

describe("createPaymentExcelBuffer", () => {
  it("writes the template sheet names, headers, filters, and frozen identifiers", async () => {
    const buffer = await createPaymentExcelBuffer({
      paymentCount: 1, employeeCount: 1, firstYear: 2021, lastYear: 2021,
      sheets: [
        { name: "PAYMENT_YEARLY", headers: ["ID", "NAME", 2021, "REFUND", "STATUS", "REMARKS", "DATE"], rows: [["000001", "DELA CRUZ, JUAN A.", 100, 10, "ACTIVE", null, null]], freezeColumns: 2, comments: [{ rowIndex: 0, columnIndex: 3, text: "Refund detail" }] },
        { name: "PAYMENT_MONTHLY", headers: ["ID", "NAME", "YEAR", "JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC", "REFUND", "STATUS", "REMARKS", "DATE"], rows: [["000001", "DELA CRUZ, JUAN A.", 2021, 100, null, null, null, null, null, null, null, null, null, null, null, 10, "ACTIVE", null, null]], freezeColumns: 2 },
      ],
    });
    const workbook = await new Workbook().xlsx.load(buffer);

    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual(["PAYMENT_YEARLY", "PAYMENT_MONTHLY"]);
    const yearly = workbook.getWorksheet("PAYMENT_YEARLY")!;
    expect(yearly.getRow(1).values).toEqual([undefined, "ID", "NAME", 2021, "REFUND", "STATUS", "REMARKS", "DATE"]);
    expect(yearly.views[0]).toMatchObject({ state: "frozen", xSplit: 2, ySplit: 1 });
    expect(yearly.autoFilter).toBe("A1:G1");
    expect(yearly.getCell("A2").value).toBe("000001");
    expect(yearly.getCell("D2").note).toBe("Refund detail");
  });
});
