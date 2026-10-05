import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { UnsavedChangesContext as Context, type Guard, type Confirmation } from "./unsavedChanges";
import { useBlocker } from "react-router-dom";
import { AlertTriangle, ArrowLeft, Trash2, X } from "lucide-react";

export function UnsavedChangesProvider({ children }: { children: ReactNode }) {
  const [guards, setGuards] = useState<Record<string, Guard>>({});
  const [pending, setPending] = useState<Confirmation | null>(null);
  const dirty = Object.values(guards).some((guard) => guard.dirty);
  const busy = Object.values(guards).some((guard) => guard.busy);
  const blocker = useBlocker(({ currentLocation, nextLocation }) => (dirty || busy) && (currentLocation.pathname !== nextLocation.pathname || currentLocation.search !== nextLocation.search));
  useEffect(() => {
    if (!dirty && !busy && blocker.state === "blocked") blocker.proceed();
  }, [dirty, busy, blocker]);
  const register = useCallback((id: string, guard: Guard) => setGuards((current) => current[id]?.dirty === guard.dirty && current[id]?.busy === guard.busy ? current : { ...current, [id]: guard }), []);
  const unregister = useCallback((id: string) => setGuards((current) => { const next = { ...current }; delete next[id]; return next; }), []);
  const request = useCallback((action: () => void, ids?: string[]) => {
    const relevant = Object.entries(guards).filter(([id]) => !ids || ids.includes(id)).map(([, guard]) => guard);
    if (relevant.some((guard) => guard.dirty || guard.busy)) setPending({ action, ids });
    else action();
  }, [guards]);
  useEffect(() => {
    if (!dirty && !busy) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, busy]);
  const open = Boolean(pending) || blocker.state === "blocked";
  const cancel = useCallback(() => { setPending(null); if (blocker.state === "blocked") blocker.reset(); }, [blocker]);
  const dialog = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const panel = dialog.current;
    panel?.querySelector<HTMLButtonElement>("footer button")?.focus();
    const keys = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); cancel(); }
      if (event.key === "Tab") {
        const buttons = Array.from(panel?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? []);
        const first = buttons[0], last = buttons.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener("keydown", keys, true);
    return () => { document.removeEventListener("keydown", keys, true); previous?.focus(); };
  }, [open, cancel]);
  function discard() {
    if (busy) return;
    if (blocker.state === "blocked") { blocker.proceed(); setPending(null); return; }
    const action = pending?.action;
    setPending(null);
    action?.();
  }
  return <Context.Provider value={{ register, unregister, request, confirm: setPending }}>
    {children}
    {open ? <div className="fixed inset-0 z-[200] flex items-center justify-center bg-ink/45 p-4">
      <div ref={dialog} role="alertdialog" aria-modal="true" aria-labelledby="unsaved-title" aria-describedby="unsaved-description" className="w-full max-w-sm rounded-md border border-line bg-white shadow-2xl">
        <header className="flex items-center gap-2 border-b border-line px-4 py-3"><AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" /><h2 id="unsaved-title" className="flex-1 text-sm font-semibold">{busy ? "Save in progress" : pending?.title ?? "Discard unsaved changes?"}</h2><button type="button" onClick={cancel} className="icon-button" aria-label="Cancel leaving"><X className="h-4 w-4" /></button></header>
        <p id="unsaved-description" className="px-4 py-4 text-sm text-ink/65">{busy ? "Wait for the current operation to finish before leaving." : pending?.message ?? "Your changes have not been saved. Discard them to leave, or continue editing."}</p>
        <footer className="flex flex-wrap justify-end gap-2 border-t border-line px-4 py-3"><button type="button" onClick={cancel} className="secondary-button"><ArrowLeft className="h-4 w-4" />{pending?.message ? "Cancel" : "Continue editing"}</button><button type="button" disabled={busy} onClick={discard} className="primary-button bg-red-700 hover:bg-red-800"><Trash2 className="h-4 w-4" />{pending?.confirmLabel ?? "Discard changes"}</button></footer>
      </div>
    </div> : null}
  </Context.Provider>;
}
