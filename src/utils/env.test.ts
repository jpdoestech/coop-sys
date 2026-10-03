import { describe, expect, it } from "vitest";
import { getAppMode } from "./env";

describe("getAppMode", () => {
  it("honors an explicitly configured mode", () => {
    expect(getAppMode({ VITE_APP_MODE: "OFFLINE", PROD: true })).toBe("OFFLINE");
    expect(getAppMode({ VITE_APP_MODE: "AUTO", PROD: true })).toBe("AUTO");
  });

  it("defaults hosted production builds to online mode", () => {
    expect(getAppMode({ PROD: true })).toBe("ONLINE");
  });

  it("keeps local development automatic", () => {
    expect(getAppMode({ PROD: false })).toBe("AUTO");
  });
});
