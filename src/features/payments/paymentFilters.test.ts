import { describe, expect, it } from "vitest";
import { compactPeriod, parseYearFilter } from "./paymentFilters";

describe("payment transaction filters", () => {
  it("accepts one year and inclusive year ranges", () => {
    expect(parseYearFilter("2026")).toEqual({ yearFrom: 2026, yearTo: 2026 });
    expect(parseYearFilter("2021-2025")).toEqual({ yearFrom: 2021, yearTo: 2025 });
    expect(parseYearFilter("2025-2021")).toBeNull();
  });

  it("formats cut-offs without repeating the year", () => {
    expect(compactPeriod("2025-01-01", "2025-01-15", "2025-01-15").period).toBe("Jan_1-15");
  });
});
