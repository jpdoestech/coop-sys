import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createAuthService } from "./authFactory";
import { AuthContextValue } from "./authContextValue";
import type { AuthSession } from "./types";

export function AuthProvider({ children }: { children: ReactNode }) {
  const service = useMemo(() => createAuthService(), []);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void service.getSession().then((value) => { if (active) setSession(value); }).catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : "Authentication could not be initialized."); }).finally(() => { if (active) setLoading(false); });
    const unsubscribe = service.subscribe((value) => { if (active) setSession(value); });
    return () => { active = false; unsubscribe(); };
  }, [service]);

  async function perform(action: () => Promise<AuthSession | void>) {
    setError(null);
    try {
      const result = await action();
      if (result) setSession(result);
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "Authentication failed.";
      setError(message);
      throw reason;
    }
  }

  return <AuthContextValue.Provider value={{
    session,
    loading,
    error,
    signIn: (email, password) => perform(() => service.signIn(email, password)),
    signOut: () => perform(async () => { await service.signOut(); setSession(null); }),
    changePassword: (password) => perform(() => service.changePassword(password)),
    requestPasswordReset: (email) => perform(() => service.requestPasswordReset(email)),
    clearError: () => setError(null),
  }}>{children}</AuthContextValue.Provider>;
}
