import type { SystemUser } from "../../../types/systemUser";
import type { AccessProfile } from "../../access/accessControl";
import type { AuthService, AuthSession } from "../types";
import { ensureDevelopmentCredentials, localCredentialFor, setLocalCredential, verifyLocalCredential } from "./localCredentialStore";

const USER_KEY = "coop_sys_user_access";
const SESSION_KEY = "coop_sys_local_session";

function readUsers(): SystemUser[] {
  const raw = localStorage.getItem(USER_KEY);
  return raw ? JSON.parse(raw) as SystemUser[] : [];
}

function sessionFor(user: SystemUser): AuthSession {
  const profile: AccessProfile = { userId: user.id, displayName: user.display_name, role: user.role, branchIds: user.branch_ids };
  return { profile, email: user.email, mode: "offline", mustChangePassword: localCredentialFor(user.id)?.mustChangePassword ?? true };
}

export class LocalAuthService implements AuthService {
  private listeners = new Set<(session: AuthSession | null) => void>();

  async getSession() {
    await ensureDevelopmentCredentials();
    const userId = localStorage.getItem(SESSION_KEY);
    const user = readUsers().find((item) => item.id === userId && item.is_active);
    return user ? sessionFor(user) : null;
  }

  async signIn(email: string, password: string) {
    await ensureDevelopmentCredentials();
    const user = readUsers().find((item) => item.email.toLowerCase() === email.trim().toLowerCase());
    if (!user || !user.is_active || !(await verifyLocalCredential(user.id, password))) throw new Error("Email or password is incorrect.");
    localStorage.setItem(SESSION_KEY, user.id);
    const session = sessionFor(user);
    this.emit(session);
    return session;
  }

  async signOut() {
    localStorage.removeItem(SESSION_KEY);
    this.emit(null);
  }

  async changePassword(password: string) {
    const userId = localStorage.getItem(SESSION_KEY);
    const user = readUsers().find((item) => item.id === userId && item.is_active);
    if (!user) throw new Error("Your local session has expired.");
    await setLocalCredential(user.id, password, false);
    const session = sessionFor(user);
    this.emit(session);
    return session;
  }

  async requestPasswordReset() {
    throw new Error("Offline passwords can only be reset by a Super Admin on this device.");
  }

  subscribe(callback: (session: AuthSession | null) => void) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private emit(session: AuthSession | null) {
    this.listeners.forEach((listener) => listener(session));
  }
}
