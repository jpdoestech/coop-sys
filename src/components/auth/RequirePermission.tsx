import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAccess } from "../../services/access/useAccess";
import type { Permission } from "../../services/access/accessControl";

export function RequirePermission({ permission, children }: { permission: Permission; children: ReactNode }) {
  const { can } = useAccess();
  return can(permission) ? children : <Navigate to="/" replace />;
}

