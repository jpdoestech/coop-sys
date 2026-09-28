import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type { OrganizationDirectory } from "../../types/organization";
import { branches as seedBranches, clients as seedClients, replaceOrganizationLookups } from "../lookups/organization";
import { createOrganizationDirectoryRepository } from "../repositories/organizationDirectoryRepositoryFactory";
import { OrganizationContextValue } from "./organizationContextValue";

const initial: OrganizationDirectory = { branches: seedBranches, clients: seedClients, departments: [], positions: [] };

export function OrganizationProvider({ children }: { children: ReactNode }) {
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
  async function save(action: () => Promise<void>) { await action(); await refresh(); }
  return <OrganizationContextValue.Provider value={{ ...directory, loading, error,
    saveBranch: (record) => save(() => repository.saveBranch(record)),
    saveClient: (record) => save(() => repository.saveClient(record)),
    saveDepartment: (record) => save(() => repository.saveDepartment(record)),
    savePosition: (record) => save(() => repository.savePosition(record)),
  }}>{children}</OrganizationContextValue.Provider>;
}
