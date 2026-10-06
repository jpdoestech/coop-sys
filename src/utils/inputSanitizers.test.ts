import { describe, expect, it } from "vitest";
import { normalizeProperCase, normalizeWhitespace, sanitizeGovernmentId, sanitizePhoneNumber } from "./inputSanitizers";

describe("input sanitizers", () => {
  it("trims repeated whitespace and capitalizes each word", () => {
    expect(normalizeProperCase("  JUAN   DELA\tCRUZ ")).toBe("Juan Dela Cruz");
    expect(normalizeProperCase(" élENA ")).toBe("Élena");
    expect(normalizeWhitespace("  III ")).toBe("III");
  });
  it("handles hyphenated names, apostrophes and trailing Roman numeral suffixes", () => {
    expect(normalizeProperCase("MARIA-ELENA O'NEIL")).toBe("Maria-Elena O'Neil");
    expect(normalizeProperCase("juan dela cruz iii")).toBe("Juan Dela Cruz III");
    expect(normalizeProperCase("juan dela cruz jr.")).toBe("Juan Dela Cruz Jr.");
    expect(normalizeProperCase("   ")).toBe("");
  });
  it("formats SSS digits and inserts hyphens automatically", () => {
    expect(sanitizeGovernmentId("12A3456789-extra", "sss")).toBe("12-345678-9");
  });

  it("formats each government identifier using its required grouping", () => {
    expect(sanitizeGovernmentId("123456789012", "pagibig")).toBe("1234-5678-9012");
    expect(sanitizeGovernmentId("123456789012", "philhealth")).toBe("12-345678901-2");
    expect(sanitizeGovernmentId("123456789012999", "tin")).toBe("123-456-789-012");
  });

  it("keeps phone punctuation, removes letters, and allows one plus sign", () => {
    expect(sanitizePhoneNumber("++63 (917) CALL-1234")).toBe("+63 (917) -1234");
  });
});
