import { describe, expect, it } from "vitest";
import {
  allocatePayment,
  effectiveSettings,
  normalizePaymentSettings,
  pesosToCentavos,
} from "./paymentMath";

const settings = { id: "1", membership_fee_centavos: 50000, capital_share_target_centavos: 500000, effective_from: "2026-01-01", effective_to: null, is_active: true, created_at: "", updated_at: "" };

describe("payment allocation", () => {
  it("pays the membership fee before capital share", () => {
    expect(allocatePayment(30000, settings, [])).toEqual({ membershipFeeCentavos: 30000, capitalShareCentavos: 0 });
    expect(allocatePayment(40000, settings, [{ membership_fee_centavos: 30000 }])).toEqual({ membershipFeeCentavos: 20000, capitalShareCentavos: 20000 });
  });
  it("converts peso input to integer centavos", () => expect(pesosToCentavos("5,500.25")).toBe(550025));
  it("uses the latest same-date setting and preserves historical periods", () => {
    const history = normalizePaymentSettings([
      {
        ...settings,
        id: "old",
        effective_from: "2020-01-01",
        is_active: false,
        updated_at: "2020-01-01T00:00:00.000Z",
      },
      {
        ...settings,
        id: "six-thousand",
        capital_share_target_centavos: 600000,
        updated_at: "2026-10-03T08:00:00.000Z",
      },
      {
        ...settings,
        id: "five-thousand",
        capital_share_target_centavos: 500000,
        updated_at: "2026-10-03T09:00:00.000Z",
      },
    ]);

    expect(history).toHaveLength(2);
    expect(effectiveSettings(history, "2025-12-31")?.id).toBe("old");
    expect(
      effectiveSettings(history, "2026-10-03")
        ?.capital_share_target_centavos,
    ).toBe(500000);
  });
});
