import { describe, expect, it } from "vitest";
import { aliasRowsFromSpreadsheet } from "./excelWorkbook";

describe("aliasRowsFromSpreadsheet", () => {
  it("accepts ID or NAME and requires an alias", () => {
    expect(aliasRowsFromSpreadsheet([{ ID: "000001", NAME: "", ALIAS: "DELA CRUZ, JUAN" }])[0]).toMatchObject({ id: "000001", alias: "DELA CRUZ, JUAN" });
    expect(() => aliasRowsFromSpreadsheet([{ ID: "", NAME: "", ALIAS: "JUAN" }])).toThrow("ID or NAME");
  });
});
