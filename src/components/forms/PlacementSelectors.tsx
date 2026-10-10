import { SearchableSelect } from "../ui/SearchableSelect";
import { FilterField } from "../ui/FilterField";
import type { ReactNode } from "react";
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
  layout?: "inline" | "filters";
};

export function PlacementSelectors({ branchId, clientId, onBranchChange, onClientChange, layout = "inline" }: Props) {
  const { profile } = useAccess();
  const directory = useOrganization();
  const options = placementOptions(profile, directory.branches, directory.clients);
  const clients = options.clients.filter((client) => !branchId || client.branchId === branchId);
  const scoped = isBranchScoped(profile);
  const field = (label: string, children: ReactNode) => layout === "filters" ? <FilterField label={label}>{children}</FilterField> : children;
  const wrapperClass = layout === "filters" ? "relative" : "relative min-w-[150px] flex-1 sm:flex-none";
  const controlClass = `compact-control w-full pl-8 ${layout === "inline" ? "sm:w-44" : ""}`;

  const fields = <>
    {options.branches.length > 1 ? field("Office / Branch", <div className={wrapperClass}>
      <Building2 className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink/40" />
      <SearchableSelect aria-label="Office or branch" className={controlClass} value={branchId} onChange={(event) => onBranchChange(event.target.value)}>
        <option value="">{scoped ? "All assigned branches" : "All offices and branches"}</option>
        {options.branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.label}</option>)}
      </SearchableSelect>
    </div>) : null}
    {clients.length > 1 ? field("Client", <div className={wrapperClass}>
      <BriefcaseBusiness className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink/40" />
      <SearchableSelect aria-label="Client" className={controlClass} value={clientId} onChange={(event) => onClientChange(event.target.value)}>
        <option value="">All clients</option>
        {clients.map((client) => <option key={client.id} value={client.id}>{client.label}</option>)}
      </SearchableSelect>
    </div>) : null}
  </>;
  return layout === "filters" && (options.branches.length > 1 || clients.length > 1) ? <div className="toolbar-filters col-span-full">{fields}</div> : fields;
}
