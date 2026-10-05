import { SearchableSelect } from "../ui/SearchableSelect";
import { Building2, BriefcaseBusiness } from "lucide-react";
import { useAccess } from "../../services/access/useAccess";
import { isBranchScoped } from "../../services/access/accessControl";
import { placementOptions } from "../../services/access/placementOptions";
import { useOrganization } from "../../services/organization/useOrganization";

type Props = {
  branchId: string;
  clientId: string;
  onBranchChange: (value: string) => void;
  onClientChange: (value: string) => void;
};

export function PlacementSelectors({ branchId, clientId, onBranchChange, onClientChange }: Props) {
  const { profile } = useAccess();
  const directory = useOrganization();
  const options = placementOptions(profile, directory.branches, directory.clients);
  const clients = options.clients.filter((client) => !branchId || client.branchId === branchId);
  const scoped = isBranchScoped(profile);

  return <>
    {options.branches.length > 1 ? <div className="relative min-w-[150px] flex-1 sm:flex-none">
      <Building2 className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink/40" />
      <SearchableSelect aria-label="Office or branch" className="compact-control w-full pl-8 sm:w-44" value={branchId} onChange={(event) => onBranchChange(event.target.value)}>
        <option value="">{scoped ? "All assigned branches" : "All offices and branches"}</option>
        {options.branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.label}</option>)}
      </SearchableSelect>
    </div> : null}
    {clients.length > 1 ? <div className="relative min-w-[150px] flex-1 sm:flex-none">
      <BriefcaseBusiness className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink/40" />
      <SearchableSelect aria-label="Client" className="compact-control w-full pl-8 sm:w-44" value={clientId} onChange={(event) => onClientChange(event.target.value)}>
        <option value="">All clients</option>
        {clients.map((client) => <option key={client.id} value={client.id}>{client.label}</option>)}
      </SearchableSelect>
    </div> : null}
  </>;
}
