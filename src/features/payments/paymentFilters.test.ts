import { describe, expect, it } from "vitest";
import { compactPeriod, detailedPeriod, parseYearFilter } from "./paymentFilters";

describe("payment filters", () => {
  it("parses single years and ranges", () => {
    expect(parseYearFilter("2026")).toEqual({ yearFrom: 2026, yearTo: 2026 });
    expect(parseYearFilter("2021-2025")).toEqual({ yearFrom: 2021, yearTo: 2025 });
    expect(parseYearFilter("2025-2021")).toBeNull();
  });

  it("formats payroll periods as readable dates", () => {
    expect(detailedPeriod("2025-01-01", "2025-01-15", "2025-01-15")).toBe("January Jan. 1-15, 2025");
    expect(detailedPeriod("2026-01-26", "2026-02-10", "2026-02-10")).toBe("January Jan. 26-Feb. 10, 2026");
    expect(detailedPeriod(null, null, "2026-03-09")).toBe("March Mar. 9, 2026");
    expect(compactPeriod("2025-01-01", "2025-01-15", "2025-01-15")).toEqual({
      month: "Jan",
      period: "Jan_1-15",
    });
  });
});
