import type { ImportErrorType } from "./personImport";

export const importErrorLabels: Record<ImportErrorType, string> = { identity: "Identity / names", date: "Dates", contact: "Contact", address: "Address", government_id: "Government IDs", lookup: "Lookup values", beneficiary: "Beneficiaries", validation: "Validation", scope: "Access / deployment", duplicate: "Duplicate IDs", save: "Save failures" };

export function importFieldCategory(header: string): ImportErrorType {
  if (header.includes("DATE")) return "date";
  if (header.startsWith("BENEFICIARY")) return "beneficiary";
  if (["SSS NUMBER", "PAG-IBIG NUMBER", "PHILHEALTH NUMBER", "TIN"].includes(header)) return "government_id";
  if (/MOBILE|EMAIL|CONTACT/.test(header)) return "contact";
  if (/ADDRESS|BARANGAY|CITY|MUNICIPALITY|PROVINCE|POSTAL/.test(header)) return "address";
  if (/^(ID|FIRST NAME|MIDDLE NAME|LAST NAME|SUFFIX)$/.test(header)) return "identity";
  if (/STATUS|TYPE|DEPARTMENT|POSITION|RELIGION|ATTAINMENT/.test(header)) return "lookup";
  return "validation";
}
