import type { AccessProfile } from "../access/accessControl";

export type AuthenticationMode = "online" | "offline";

export type AuthSession = {
  profile: AccessProfile;
  email: string;
  mode: AuthenticationMode;
  mustChangePassword: boolean;
};

export interface AuthService {
  getSession(): Promise<AuthSession | null>;
  signIn(email: string, password: string): Promise<AuthSession>;
  signOut(): Promise<void>;
  changePassword(password: string): Promise<AuthSession>;
  requestPasswordReset(email: string): Promise<void>;
  subscribe(callback: (session: AuthSession | null) => void): () => void;
}
