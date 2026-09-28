import { describe, expect, it } from "vitest";
import { developmentMembers } from "../../database/seeds/memberSeed";
import { nextBodResolutionNumber } from "./membershipApproval";

describe("BOD membership approval", () => {
  it("increments the highest resolution number", () => {
    expect(nextBodResolutionNumber(developmentMembers)).toBe("000006");
  });
});
