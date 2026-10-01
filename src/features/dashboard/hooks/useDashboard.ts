import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAccess } from "../../../services/access/useAccess";
import { createDashboardRepository } from "../../../services/repositories/dashboardRepositoryFactory";

export function useDashboard() {
  const { profile } = useAccess();
  const repository = useMemo(() => createDashboardRepository(), []);

  return useQuery({
    queryKey: ["dashboard", profile.userId, profile.role, profile.branchIds],
    queryFn: () => repository.getSnapshot(profile),
  });
}
