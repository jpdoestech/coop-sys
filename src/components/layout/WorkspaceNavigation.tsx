import { ChevronRight } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useConfirmLeave } from "../forms/unsavedChanges";

type Segment = { label: string; onSelect?: () => void };
type Registration = { id: string; pathname: string; dialog: boolean; segments: () => Segment[]; close?: () => void };
type NavigationContext = { pathname: string; registrations: Registration[]; register: (entry: Registration) => () => void; navigate: (path: string) => void };
const Context = createContext<NavigationContext | null>(null);

const routes = [
  ["/settings/users", "User Access"], ["/organization/departments", "Departments"], ["/organization/positions", "Positions"],
  ["/members", "Members"], ["/employees", "Employees"], ["/payments", "Payments"], ["/organization", "Organization"],
  ["/payroll", "Payroll"],
  ["/documents", "Documents"], ["/reports", "Reports"], ["/sync", "Synchronization"], ["/audit-logs", "Audit Logs"], ["/settings", "Settings"],
] as const;

function routeSegments(pathname: string, navigate: (path: string) => void): Segment[] {
  const route = routes.find(([path]) => pathname === path) || ["/", "Dashboard"];
  if (pathname.startsWith("/organization/")) return [{ label: "Organization", onSelect: () => navigate("/organization") }, { label: route[1] }];
  return [{ label: route[1], onSelect: () => navigate(route[0]) }];
}

export function WorkspaceNavigationProvider({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const register = useCallback((entry: Registration) => {
    setRegistrations((current) => [...current.filter((item) => item.id !== entry.id), entry]);
    return () => setRegistrations((current) => current.filter((item) => item.id !== entry.id));
  }, []);
  return <Context.Provider value={{ pathname, registrations, register, navigate }}>{children}</Context.Provider>;
}

function useRegistration(segments: Segment[], dialog: boolean, onClose?: () => void) {
  const context = useContext(Context);
  const id = useId();
  const latest = useRef({ segments, onClose });
  latest.current = { segments, onClose };
  const register = context?.register, pathname = context?.pathname;
  const labels = JSON.stringify(segments.map((segment) => segment.label));
  useEffect(() => {
    if (!register || !pathname) return;
    return register({ id, pathname, dialog, segments: () => latest.current.segments, close: dialog ? () => latest.current.onClose?.() : undefined });
  }, [register, pathname, id, dialog, labels]);
}

export function useWorkspacePath(segments: Segment[]) { useRegistration(segments, false); }
export function useWorkspaceDialog(label: string, onClose: () => void) { useRegistration([{ label }], true, onClose); }

export function WorkspaceBreadcrumbs({ className = "", dialog = false }: { className?: string; dialog?: boolean }) {
  const context = useContext(Context);
  const confirmLeave = useConfirmLeave();
  if (!context) return null;
  const active = context.registrations.filter((entry) => entry.pathname === context.pathname);
  const page = active.filter((entry) => !entry.dialog).at(-1);
  const base = page?.segments() || routeSegments(context.pathname, context.navigate);
  const dialogs = active.filter((entry) => entry.dialog);
  const segments = [...base, ...dialogs.flatMap((entry) => entry.segments())];
  function select(index: number) {
    confirmLeave(() => {
      const remainingDialogs = Math.max(0, index - base.length + 1);
      dialogs.slice(remainingDialogs).reverse().forEach((entry) => entry.close?.());
      segments[index].onSelect?.();
    });
  }
  return <nav aria-label={dialog ? "Dialog breadcrumb" : "Workspace breadcrumb"} className={`min-w-0 overflow-x-auto ${className}`}>
    <ol className="flex min-w-max items-center gap-1.5 py-0.5 text-sm">
      {segments.map((segment, index) => <li key={`${index}:${segment.label}`} className="flex items-center gap-1.5">
        {index ? <ChevronRight className="h-3.5 w-3.5 shrink-0 text-ink/35" aria-hidden="true" /> : null}
        {index === segments.length - 1 ? <span aria-current="page" className="font-semibold text-ink">{segment.label}</span> : <button type="button" onClick={() => select(index)} className="focus-ring rounded-sm text-ink/60 underline-offset-4 hover:text-moss hover:underline">{segment.label}</button>}
      </li>)}
    </ol>
  </nav>;
}
