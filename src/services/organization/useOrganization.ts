import { useContext } from "react";
import { OrganizationContextValue } from "./organizationContextValue";

export function useOrganization() {
  const value = useContext(OrganizationContextValue);
  if (!value) throw new Error("useOrganization must be used inside OrganizationProvider.");
  return value;
}
