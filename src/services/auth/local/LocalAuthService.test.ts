import { beforeEach, describe, expect, it } from "vitest";
import { LocalAuthService } from "./LocalAuthService";
import { DEVELOPMENT_TEMPORARY_PASSWORD } from "./localCredentialStore";

describe("LocalAuthService", () => {
  beforeEach(() => localStorage.clear());

  it("authenticates locally, requires a password change, and restores the session", async () => {
    const service = new LocalAuthService();
    await expect(service.signIn("admin@example.test", "incorrect-password")).rejects.toThrow("incorrect");
    const temporarySession = await service.signIn("admin@example.test", DEVELOPMENT_TEMPORARY_PASSWORD);
    expect(temporarySession.profile.role).toBe("super_admin");
    expect(temporarySession.mustChangePassword).toBe(true);

    const updatedSession = await service.changePassword("A-New-Local-Password-123!");
    expect(updatedSession.mustChangePassword).toBe(false);
    expect((await service.getSession())?.profile.userId).toBe(updatedSession.profile.userId);

    await service.signOut();
    expect(await service.getSession()).toBeNull();
    await expect(service.signIn("admin@example.test", DEVELOPMENT_TEMPORARY_PASSWORD)).rejects.toThrow("incorrect");
    await expect(service.signIn("admin@example.test", "A-New-Local-Password-123!")).resolves.toMatchObject({ mustChangePassword: false });
  });
});
