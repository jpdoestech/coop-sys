import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { createOrganizationDirectoryRepository } from "../../../services/repositories/organizationDirectoryRepositoryFactory";
import type {
  OrganizationListOptions,
  OrganizationRecordKind,
} from "../../../services/repositories/OrganizationDirectoryRepository";

export function useOrganizationRecords(
  kind: OrganizationRecordKind,
  options: OrganizationListOptions,
) {
  const repository = useMemo(() => createOrganizationDirectoryRepository(), []);
  return useQuery({
    queryKey: ["organization-records", kind, options],
    queryFn: () => repository.listRecords(kind, options),
  });
}
