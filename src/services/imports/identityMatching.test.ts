import { describe, expect, it } from "vitest";
import { nameSimilarity, normalizeIdentityName } from "./identityMatching";

describe("identity matching", () => {
  it("normalizes punctuation, accents, case, and spacing", () => expect(normalizeIdentityName("  José  Dela-Cruz ")).toBe("JOSE DELA CRUZ"));
  it("provides fuzzy suggestions without treating them as exact", () => expect(nameSimilarity("Maria Santos", "Marya Santos")).toBeGreaterThan(0.7));
});
