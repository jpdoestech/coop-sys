import { describe, expect, it } from "vitest";
import { nextPersonNumber, normalizePersonNumber } from "./personNumber";

describe("person numbers", () => {
  it("normalizes legacy prefixes to six digits", () => {
    expect(normalizePersonNumber("MEM-19")).toBe("000019");
    expect(normalizePersonNumber("EMP-000001")).toBe("000001");
  });

  it("increments across both membership and employee records", () => {
    expect(nextPersonNumber(
      [{ membership_number: "000019" }],
      [{ employee_number: "000024" }],
    )).toBe("000025");
  });
});
