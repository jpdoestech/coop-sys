import {
  BarChart3,
  Building2,
  FileText,
  Gauge,
  Menu,
  Settings,
  ShieldCheck,
  Users,
  UserSquare2,
  UserCog,
  LogOut,
  Wifi,
  Landmark,
  WalletCards
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { clsx } from "clsx";
import { useOnlineStatus } from "../../hooks/useOnlineStatus";
import { getAppMode } from "../../utils/env";
import { useAccess } from "../../services/access/useAccess";
import { roleLabel, type Permission } from "../../services/access/accessControl";
import { useAuth } from "../../services/auth/useAuth";

type AppShellProps = {
  children: ReactNode;
};

const navItems: Array<{ to: string; label: string; icon: typeof Gauge; permission: Permission }> = [
  { to: "/", label: "Dashboard", icon: Gauge, permission: "dashboard.view" },
  { to: "/members", label: "Members", icon: Users, permission: "members.view" },
  { to: "/employees", label: "Employees", icon: UserSquare2, permission: "employees.view" },
  { to: "/payments", label: "Payments", icon: WalletCards, permission: "payments.view" },
  { to: "/organization", label: "Organization", icon: Building2, permission: "organization.manage" },
  { to: "/documents", label: "Documents", icon: FileText, permission: "documents.view" },
  { to: "/reports", label: "Reports", icon: BarChart3, permission: "reports.view" },
  { to: "/sync", label: "Synchronization", icon: Wifi, permission: "sync.manage" },
  { to: "/audit-logs", label: "Audit Logs", icon: ShieldCheck, permission: "audit.view" },
  { to: "/settings/users", label: "User Access", icon: UserCog, permission: "users.manage" },
  { to: "/settings", label: "Settings", icon: Settings, permission: "settings.manage" }
];

export function AppShell({ children }: AppShellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const online = useOnlineStatus();
  const appMode = getAppMode();
  const { profile, can } = useAccess();
  const { session, signOut } = useAuth();
  const visibleNavItems = navItems.filter((item) => can(item.permission));

  const sidebar = (
    <aside className="flex h-full w-56 shrink-0 flex-col border-r border-line bg-white">
      <div className="flex h-14 items-center gap-3 border-b border-line px-4">
        <span className="flex h-9 w-9 items-center justify-center rounded-md bg-moss text-white"><Landmark className="h-5 w-5" /></span>
        <div className="min-w-0">
          <h1 className="truncate text-sm font-bold text-ink">Records Desk</h1>
          <p className="truncate text-[11px] text-ink/50">Cooperative operations</p>
        </div>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-ink/35">Workspace</p>
        {visibleNavItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={() => setIsOpen(false)}
            className={({ isActive }) =>
              clsx(
                "focus-ring relative flex min-h-10 items-center gap-3 rounded-md px-3 text-[13px] font-medium transition",
                isActive
                  ? "bg-emerald-50 text-moss before:absolute before:-left-3 before:h-5 before:w-0.5 before:rounded-r before:bg-moss"
                  : "text-ink/65 hover:bg-paper hover:text-ink"
              )
            }
          >
            <item.icon className="h-[18px] w-[18px]" strokeWidth={1.8} aria-hidden="true" />
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-line p-3">
        <div className="flex items-center gap-2 rounded-md p-2 hover:bg-paper">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#e4efe9] text-xs font-bold text-moss">{profile.displayName.split(" ").map((part) => part[0]).slice(0, 2).join("")}</span>
          <div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold text-ink">{profile.displayName}</p><p className="truncate text-[11px] text-ink/50">{roleLabel(profile.role)}</p></div>
          <button onClick={() => void signOut()} className="icon-button h-8 w-8" title="Sign out" aria-label="Sign out"><LogOut className="h-4 w-4" /></button>
        </div>
        <div className="mt-2 flex items-center justify-between px-2 text-[10px] text-ink/40"><span>{session?.mode === "online" ? "Online account" : "Offline account"}</span><span>{appMode}</span></div>
      </div>
    </aside>
  );

  return (
    <div className="min-h-screen bg-paper font-sans text-ink">
      <div className="flex min-h-screen">
        <div className="hidden lg:block">{sidebar}</div>
        {isOpen ? (
          <div className="fixed inset-0 z-40 lg:hidden">
            <button
              className="absolute inset-0 bg-ink/40"
              onClick={() => setIsOpen(false)}
              aria-label="Close navigation"
            />
            <div className="relative h-full">{sidebar}</div>
          </div>
        ) : null}

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 border-b border-line bg-white/90 backdrop-blur">
            <div className="flex h-14 items-center justify-between gap-4 px-4 sm:px-6">
              <button
                className="focus-ring rounded-md border border-line bg-white p-2 lg:hidden"
                onClick={() => setIsOpen(true)}
                aria-label="Open navigation"
              >
                <Menu className="h-5 w-5" />
              </button>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">Membership &amp; Workforce</p>
                <p className="truncate text-xs text-ink/45">Head Office / Operations</p>
              </div>
              <div className="flex items-center gap-2 rounded-full bg-paper px-3 py-1.5 text-xs font-medium text-ink/65">
                <span
                  className={clsx(
                    "h-2 w-2 rounded-full",
                    online ? "bg-emerald-500" : "bg-red-500"
                  )}
                />
                {online ? "Online" : "Working Offline"}
              </div>
            </div>
          </header>
          <main className="flex-1 px-4 py-4 sm:px-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
