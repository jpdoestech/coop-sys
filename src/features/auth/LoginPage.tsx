import { useState, type FormEvent } from "react";
import { ArrowLeft, KeyRound, LockKeyhole, LogIn, Mail } from "lucide-react";
import { useAuth } from "../../services/auth/useAuth";
import { getAppMode } from "../../utils/env";

export function LoginPage() {
  const { signIn, requestPasswordReset, error, clearError } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [resetMode, setResetMode] = useState(false);
  const mode = getAppMode();
  const offline = mode === "OFFLINE" || !import.meta.env.VITE_SUPABASE_URL || (mode === "AUTO" && !navigator.onLine);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    clearError();
    try {
      if (resetMode) {
        await requestPasswordReset(email);
        setMessage("Password reset instructions were sent.");
      } else {
        await signIn(email, password);
      }
    } catch {
      // The provider exposes the actionable error.
    } finally {
      setBusy(false);
    }
  }

  return <main className="flex min-h-screen items-center justify-center bg-paper px-4 py-10 text-ink">
    <section className="w-full max-w-md overflow-hidden rounded border border-line bg-white shadow-panel">
      <div className="border-b border-line bg-ink px-7 py-6 text-white"><LockKeyhole className="h-6 w-6 text-[#a9c9a7]" /><p className="mt-4 text-xs font-semibold uppercase text-[#b9d4b7]">Cooperative Records</p><h1 className="mt-1 font-display text-3xl font-semibold">Sign in</h1></div>
      <form onSubmit={submit} className="space-y-5 p-7">
        <label className="block text-sm font-medium">Email address<input required type="email" autoComplete="username" maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} className="focus-ring mt-1.5 w-full rounded border border-line px-3 py-2.5" /></label>
        {!resetMode ? <label className="block text-sm font-medium">Password<input required type="password" autoComplete="current-password" minLength={8} maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} className="focus-ring mt-1.5 w-full rounded border border-line px-3 py-2.5" /></label> : null}
        {offline ? <p className="rounded border border-line bg-paper px-3 py-2 text-xs text-ink/65">Offline account authentication is active on this device.</p> : null}
        {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
        {message ? <p role="status" className="text-sm text-emerald-700">{message}</p> : null}
        <button disabled={busy} className="primary-button w-full">{resetMode ? <Mail className="h-4 w-4" /> : <LogIn className="h-4 w-4" />}{busy ? "Please wait..." : resetMode ? "Send reset link" : "Sign in"}</button>
        <button type="button" onClick={() => { clearError(); setMessage(""); setResetMode(!resetMode); }} className="focus-ring inline-flex w-full items-center justify-center gap-2 rounded-md p-2 text-sm font-semibold text-moss hover:bg-paper">{resetMode ? <ArrowLeft className="h-4 w-4" /> : <KeyRound className="h-4 w-4" />}{resetMode ? "Return to sign in" : "Forgot password?"}</button>
      </form>
    </section>
  </main>;
}
