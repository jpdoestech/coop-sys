import { useContext } from "react";
import { AccessContextValue } from "./accessContextValue";
import { hasPermission, type Permission } from "./accessControl";

export function useAccess() {
  const profile = useContext(AccessContextValue);
  if (!profile) throw new Error("useAccess must be used inside AccessProvider.");
  return { profile, can: (permission: Permission) => hasPermission(profile, permission) };
}
