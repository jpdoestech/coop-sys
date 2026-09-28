import type { ReactNode } from "react";
import type { AccessProfile } from "./accessControl";
import { developmentUsers } from "../../database/seeds/userSeed";
import { AccessContextValue } from "./accessContextValue";

function developmentProfile(): AccessProfile {
  const selectedId = localStorage.getItem("coop_sys_current_user_id");
  const user = developmentUsers.find((item) => item.id === selectedId) ?? developmentUsers[0];
  return { userId: user.id, displayName: user.display_name, role: user.role, branchIds: user.branch_ids };
}

export function AccessProvider({ children }: { children: ReactNode }) {
  return <AccessContextValue.Provider value={developmentProfile()}>{children}</AccessContextValue.Provider>;
}

