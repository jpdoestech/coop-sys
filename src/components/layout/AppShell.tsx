import {
  Archive,
  BarChart3,
  Building2,
  FileText,
  Gauge,
  Menu,
  Settings,
  ShieldCheck,
  Users,
  UserSquare2,
  Wifi,
  X
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { clsx } from "clsx";
import { useOnlineStatus } from "../../hooks/useOnlineStatus";
import { getAppMode } from "../../utils/env";

type AppShellProps = {
  children: ReactNode;
};

const navItems = [
  { to: "/", label: "Dashboard", icon: Gauge },
  { to: "/members", label: "Members", icon: Users },
  { to: "/employees", label: "Employees", icon: UserSquare2 },
  { to: "/organization/departments", label: "Departments", icon: Building2 },
  { to: "/organization/positions", label: "Positions", icon: Archive },
  { to: "/documents", label: "Documents", icon: FileText },
  { to: "/reports", label: "Reports", icon: BarChart3 },
  { to: "/sync", label: "Synchronization", icon: Wifi },
  { to: "/audit-logs", label: "Audit Logs", icon: ShieldCheck },
  { to: "/settings", label: "Settings", icon: Settings }
];

export function AppShell({ children }: AppShellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const online = useOnlineStatus();
  const appMode = getAppMode();

  const sidebar = (
    <aside className="flex h-full w-72 shrink-0 flex-col border-r border-line bg-[#fbfaf6]">
      <div className="border-b border-line px-5 py-5">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-moss">
          Cooperative
        </p>
        <h1 className="mt-1 font-display text-2xl font-semibold text-ink">
          Records Desk
        </h1>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={() => setIsOpen(false)}
            className={({ isActive }) =>
              clsx(
                "focus-ring flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition",
                isActive
                  ? "bg-moss text-white shadow-sm"
                  : "text-ink hover:bg-[#ece6dc]"
              )
            }
          >
            <item.icon className="h-4 w-4" aria-hidden="true" />
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-line px-5 py-4 text-xs text-ink/70">
        <p>Mode: {appMode}</p>
        <p className="mt-1">Last sync: Not yet synchronized</p>
      </div>
    </aside>
  );

  return (
    <div className="min-h-screen bg-paper text-ink">
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
          <header className="sticky top-0 z-30 border-b border-line bg-paper/90 backdrop-blur">
            <div className="flex items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
              <button
                className="focus-ring rounded-md border border-line bg-white p-2 lg:hidden"
                onClick={() => setIsOpen(true)}
                aria-label="Open navigation"
              >
                <Menu className="h-5 w-5" />
              </button>
              <div>
                <p className="text-sm font-semibold">Membership + Employee Information</p>
                <p className="text-xs text-ink/60">
                  Small cooperative records system
                </p>
              </div>
              <div className="flex items-center gap-2 rounded-full border border-line bg-white px-3 py-1.5 text-sm">
                <span
                  className={clsx(
                    "h-2.5 w-2.5 rounded-full",
                    online ? "bg-emerald-500" : "bg-red-500"
                  )}
                />
                {online ? "Online" : "Working Offline"}
              </div>
              <button
                className="focus-ring hidden rounded-md p-2 text-ink/70 hover:bg-[#ece6dc] lg:hidden"
                aria-label="Close navigation"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </header>
          <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
