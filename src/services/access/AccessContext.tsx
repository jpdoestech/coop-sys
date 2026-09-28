import { createContext, useContext, type ReactNode } from "react";
import type { AccessProfile } from "./accessControl";
import { hasPermission, type Permission } from "./accessControl";
import { developmentUsers } from "../../database/seeds/userSeed";

function developmentProfile(): AccessProfile {
  const selectedId = localStorage.getItem("coop_sys_current_user_id");
  const user = developmentUsers.find((item) => item.id === selectedId) ?? developmentUsers[0];
  return { userId: user.id, displayName: user.display_name, role: user.role, branchIds: user.branch_ids };
}

const AccessContext = createContext<AccessProfile | null>(null);

export function AccessProvider({ children }: { children: ReactNode }) {
  return <AccessContext.Provider value={developmentProfile()}>{children}</AccessContext.Provider>;
}

export function useAccess() {
  const profile = useContext(AccessContext);
  if (!profile) throw new Error("useAccess must be used inside AccessProvider.");
  return {
    profile,
    can: (permission: Permission) => hasPermission(profile, permission),
  };
}

