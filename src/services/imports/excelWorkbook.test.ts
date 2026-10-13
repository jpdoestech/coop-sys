import { describe, expect, it } from "vitest";
import { aliasRowsFromSpreadsheet, spreadsheetRowsFromCells } from "./excelWorkbook";

describe("aliasRowsFromSpreadsheet", () => {
  it("preserves Excel clock cells for attendance rather than converting them to dates", () => {
    expect(spreadsheetRowsFromCells([["WORK DATE", "TIME IN", "TIME OUT"], [new Date("2026-10-12T00:00:00Z"), new Date("1899-12-30T08:00:00Z"), new Date("1899-12-30T17:00:30Z")]])[0]).toEqual({ "WORK DATE": "2026-10-12", "TIME IN": "08:00:00", "TIME OUT": "17:00:30" });
  });
  it("accepts ID or NAME and requires an alias", () => {
    expect(aliasRowsFromSpreadsheet([{ ID: "000001", NAME: "", ALIAS: "DELA CRUZ, JUAN" }])[0]).toMatchObject({ id: "000001", alias: "DELA CRUZ, JUAN" });
    expect(() => aliasRowsFromSpreadsheet([{ ID: "", NAME: "", ALIAS: "JUAN" }])).toThrow("ID or NAME");
  });
});
