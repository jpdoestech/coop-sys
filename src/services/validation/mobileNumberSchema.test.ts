import { describe, expect, it } from "vitest";
import { mobileNumberSchema } from "./mobileNumberSchema";
import { normalizeStoredMobileNumber, sanitizeMobileNumber } from "../../utils/inputSanitizers";

describe("mobile numbers", () => {
  it("accepts only eleven digits starting with 09, or an empty optional field", () => {
    expect(mobileNumberSchema.safeParse("09171234567").success).toBe(true);
    expect(mobileNumberSchema.safeParse(null).success).toBe(true);
    for (const value of ["0917123456", "091712345678", "08171234567", "+639171234567", "0917-1234567", "0917abc4567"]) {
      expect(mobileNumberSchema.safeParse(value).success).toBe(false);
    }
  });
  it("limits typed digits and normalizes legacy international numbers without truncating them", () => {
    expect(sanitizeMobileNumber("0917abc123456789")).toBe("09171234567");
    expect(normalizeStoredMobileNumber("+639171234567")).toBe("09171234567");
    expect(normalizeStoredMobileNumber("12345")).toBe("12345");
  });
});
