import { hydrateDatabaseStorage } from "../../server/databaseStorage";
import { serverRequest } from "../../server/serverApi";
import type { AuthService, AuthSession } from "../types";

export class ServerAuthService implements AuthService {
  private listeners = new Set<(session: AuthSession | null) => void>();

  async getSession() {
    const result = await serverRequest<{ session: AuthSession | null }>("/auth/session");
    if (result.session) await hydrateDatabaseStorage();
    return result.session;
  }

  async signIn(email: string, password: string) {
    const result = await serverRequest<{ session: AuthSession }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    await hydrateDatabaseStorage();
    this.emit(result.session);
    return result.session;
  }

  async signOut() {
    await serverRequest("/auth/logout", { method: "POST" });
    this.emit(null);
  }

  async changePassword(password: string) {
    const result = await serverRequest<{ session: AuthSession }>("/auth/change-password", {
      method: "POST",
      body: JSON.stringify({ password }),
    });
    this.emit(result.session);
    return result.session;
  }

  async requestPasswordReset() {
    throw new Error("A Super Admin must reset server passwords from User Access.");
  }

  subscribe(callback: (session: AuthSession | null) => void) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private emit(session: AuthSession | null) {
    this.listeners.forEach((listener) => listener(session));
  }
}
