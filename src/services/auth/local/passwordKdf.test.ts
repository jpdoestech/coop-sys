import { pbkdf2Sync } from "node:crypto";
import { describe, expect, it } from "vitest";
import { derivePasswordFallback } from "./passwordKdf";

describe("derivePasswordFallback", () => {
  it("matches PBKDF2-HMAC-SHA256 output without Web Crypto", async () => {
    const password = "Password@2026";
    const salt = new TextEncoder().encode("lan-login-test");
    const actual = await derivePasswordFallback(password, salt, 1000);
    const expected = pbkdf2Sync(password, salt, 1000, 32, "sha256");

    expect(Buffer.from(actual).equals(expected)).toBe(true);
  });
});
