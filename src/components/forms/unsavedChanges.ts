import { createContext, useContext, useId, useLayoutEffect } from "react";

export type Guard = { dirty: boolean; busy: boolean };
export type Confirmation = { action: () => void; ids?: string[]; message?: string; title?: string; confirmLabel?: string };
type ContextValue = { register: (id: string, guard: Guard) => void; unregister: (id: string) => void; request: (action: () => void, ids?: string[]) => void; confirm: (confirmation: Confirmation) => void };
export const UnsavedChangesContext = createContext<ContextValue | null>(null);

export function useUnsavedChanges(dirty: boolean, busy = false) {
  const context = useContext(UnsavedChangesContext);
  const id = useId();
  const register = context?.register, unregister = context?.unregister;
  useLayoutEffect(() => { register?.(id, { dirty, busy }); }, [register, id, dirty, busy]);
  useLayoutEffect(() => () => unregister?.(id), [unregister, id]);
  return {
    confirmLeave: (action: () => void) => context ? context.request(action) : action(),
    confirmDiscard: (action: () => void) => context ? context.request(action, [id]) : action(),
  };
}

export function useConfirmLeave() {
  const context = useContext(UnsavedChangesContext);
  return (action: () => void) => context ? context.request(action) : action();
}

export function useConfirmation() {
  const context = useContext(UnsavedChangesContext);
  return (message: string, action: () => void, title = "Confirm action", confirmLabel = "Continue") => {
    if (context) context.confirm({ message, action, title, confirmLabel });
    else if (window.confirm(message)) action();
  };
}

export function draftChanged(value: unknown, baseline: unknown) {
  return JSON.stringify(value) !== JSON.stringify(baseline);
}
