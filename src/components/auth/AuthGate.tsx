import type { ReactNode } from "react";
import { ChangePasswordPage } from "../../features/auth/ChangePasswordPage";
import { LoginPage } from "../../features/auth/LoginPage";
import { useAuth } from "../../services/auth/useAuth";

export function AuthGate({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();
  if (loading) return <div className="flex min-h-screen items-center justify-center bg-paper text-sm text-ink/60">Securing workspace...</div>;
  if (!session) return <LoginPage />;
  if (session.mustChangePassword) return <ChangePasswordPage />;
  return children;
}
