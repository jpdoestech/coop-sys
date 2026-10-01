import { describe, expect, it } from "vitest";
import { allocatePayment, pesosToCentavos } from "./paymentMath";

const settings = { id: "1", membership_fee_centavos: 50000, capital_share_target_centavos: 500000, effective_from: "2026-01-01", effective_to: null, is_active: true, created_at: "", updated_at: "" };

describe("payment allocation", () => {
  it("pays the membership fee before capital share", () => {
    expect(allocatePayment(30000, settings, [])).toEqual({ membershipFeeCentavos: 30000, capitalShareCentavos: 0 });
    expect(allocatePayment(40000, settings, [{ membership_fee_centavos: 30000 }])).toEqual({ membershipFeeCentavos: 20000, capitalShareCentavos: 20000 });
  });
  it("converts peso input to integer centavos", () => expect(pesosToCentavos("5,500.25")).toBe(550025));
});
