import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type { OrganizationDirectory } from "../../types/organization";
import { branches as seedBranches, clients as seedClients, replaceOrganizationLookups } from "../lookups/organization";
import { createOrganizationDirectoryRepository } from "../repositories/organizationDirectoryRepositoryFactory";
import { OrganizationContextValue } from "./organizationContextValue";
import { useAccess } from "../access/useAccess";
import { assertPermission } from "../access/accessControl";
import { useQueryClient } from "@tanstack/react-query";

const initial: OrganizationDirectory = { branches: seedBranches, clients: seedClients, departments: [], positions: [] };

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const { profile } = useAccess();
  const queryClient = useQueryClient();
  const repository = useMemo(() => createOrganizationDirectoryRepository(), []);
  const [directory, setDirectory] = useState(initial);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    try { const next = await repository.getDirectory(); replaceOrganizationLookups(next); setDirectory(next); setError(null); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Organization records could not be loaded."); }
    finally { setLoading(false); }
  }, [repository]);
  useEffect(() => { void refresh(); }, [refresh]);
  async function save(action: () => Promise<void>, exists: boolean) { assertPermission(profile, exists ? "organization.update" : "organization.create"); await action(); await refresh(); await queryClient.invalidateQueries({ queryKey: ["organization-records"] }); }
  return <OrganizationContextValue.Provider value={{ ...directory, loading, error,
    saveBranch: (record) => save(() => repository.saveBranch(record), directory.branches.some((item) => item.id === record.id)),
    saveClient: (record) => save(() => repository.saveClient(record), directory.clients.some((item) => item.id === record.id)),
    saveDepartment: (record) => save(() => repository.saveDepartment(record), directory.departments.some((item) => item.id === record.id)),
    savePosition: (record) => save(() => repository.savePosition(record), directory.positions.some((item) => item.id === record.id)),
  }}>{children}</OrganizationContextValue.Provider>;
}
