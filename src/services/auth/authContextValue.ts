import { createContext } from "react";
import type { AuthSession } from "./types";

export type AuthContextState = {
  session: AuthSession | null;
  loading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  changePassword: (password: string) => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  clearError: () => void;
};

export const AuthContextValue = createContext<AuthContextState | null>(null);
