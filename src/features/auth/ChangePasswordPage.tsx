import { useState, type FormEvent } from "react";
import { KeyRound } from "lucide-react";
import { useAuth } from "../../services/auth/useAuth";

export function ChangePasswordPage() {
  const { changePassword, signOut, error, clearError } = useAuth();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [localError, setLocalError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setLocalError(""); clearError();
    if (password.length < 12) return setLocalError("Use at least 12 characters.");
    if (password !== confirmation) return setLocalError("Passwords do not match.");
    setBusy(true);
    try { await changePassword(password); } catch { /* Provider displays the error. */ } finally { setBusy(false); }
  }
  return <main className="flex min-h-screen items-center justify-center bg-paper px-4 py-10 text-ink"><form onSubmit={submit} className="w-full max-w-md rounded border border-line bg-white p-7 shadow-panel"><KeyRound className="h-6 w-6 text-moss" /><p className="mt-4 text-xs font-semibold uppercase text-moss">Account security</p><h1 className="mt-1 font-display text-3xl font-semibold">Set a new password</h1><p className="mt-2 text-sm text-ink/60">Your temporary password must be replaced before continuing.</p><div className="mt-6 space-y-5"><label className="block text-sm font-medium">New password<input required type="password" autoComplete="new-password" minLength={12} maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} className="focus-ring mt-1.5 w-full rounded border border-line px-3 py-2.5" /></label><label className="block text-sm font-medium">Confirm password<input required type="password" autoComplete="new-password" minLength={12} maxLength={128} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className="focus-ring mt-1.5 w-full rounded border border-line px-3 py-2.5" /></label>{localError || error ? <p role="alert" className="text-sm text-red-700">{localError || error}</p> : null}<button disabled={busy} className="focus-ring w-full rounded bg-moss px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Updating..." : "Update password"}</button><button type="button" onClick={() => void signOut()} className="focus-ring w-full rounded p-2 text-sm font-semibold text-ink/65 hover:bg-paper">Sign out</button></div></form></main>;
}
