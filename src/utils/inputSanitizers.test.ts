import { describe, expect, it } from "vitest";
import { sanitizeGovernmentId, sanitizePhoneNumber } from "./inputSanitizers";

describe("input sanitizers", () => {
  it("keeps only government ID digits and hyphens within the field limit", () => {
    expect(sanitizeGovernmentId("12A-3456789-0-extra", 12)).toBe("12-3456789-0");
  });

  it("keeps phone punctuation, removes letters, and allows one plus sign", () => {
    expect(sanitizePhoneNumber("++63 (917) CALL-1234")).toBe("+63 (917) -1234");
  });
});
