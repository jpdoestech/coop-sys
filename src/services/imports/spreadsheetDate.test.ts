import { describe, expect, it } from "vitest";
import { spreadsheetDate } from "./spreadsheetDate";
import { spreadsheetRowsFromCells } from "./excelWorkbook";

describe("spreadsheet dates", () => {
  it.each([["2024-02-29", "2024-02-29"], ["3/10/2026", "2026-03-10"], ["2026/3/26", "2026-03-26"], ["January 15, 2025", "2025-01-15"], ["15-Jan-2025", "2025-01-15"], [45292.75, "2024-01-01"], [1, "1900-01-01"], [59, "1900-02-28"], [61, "1900-03-01"]])("normalizes %s", (input, output) => {
    expect(spreadsheetDate(input)).toBe(output);
  });
  it.each(["2025-02-29", "2026-02-30", "13/1/2026", "01/01/26", "not a date", 60])("rejects invalid date %s", (input) => expect(spreadsheetDate(input)).toBeNull());
  it("supports the 1904 workbook calendar and native Excel dates without shifting the day", () => {
    expect(spreadsheetDate(0, true)).toBe("1904-01-01");
    expect(spreadsheetRowsFromCells([["BIRTH DATE", "DATE HIRED", "MOBILE", "FIRST NAME"], [new Date("1990-06-15T00:00:00Z"), 0, 9171234567, "Mira"]], true)[0]).toEqual({ "BIRTH DATE": "1990-06-15", "DATE HIRED": "1904-01-01", MOBILE: "09171234567", "FIRST NAME": "Mira" });
    expect(() => spreadsheetRowsFromCells([["ID", "ID"], [1, 2]])).toThrow("duplicate column headers");
  });
});
