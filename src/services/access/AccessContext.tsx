import type { ReactNode } from "react";
import { AccessContextValue } from "./accessContextValue";
import { useAuth } from "../auth/useAuth";

export function AccessProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  if (!session) throw new Error("AccessProvider requires an authenticated session.");
  return <AccessContextValue.Provider value={session.profile}>{children}</AccessContextValue.Provider>;
}

