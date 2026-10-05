import { employmentStatuses, employmentTypes } from "../../features/employees/data/employeeOptions";
import { memberStatuses, memberTypes } from "../../features/members/data/memberOptions";
import { educationalAttainments } from "../lookups/educationalAttainments";

export const personFieldOptions: Record<string, readonly string[]> = {
  "EMPLOYMENT STATUS": employmentStatuses.map((item) => item.label),
  "EMPLOYMENT TYPE": employmentTypes.map((item) => item.label),
  "MEMBERSHIP STATUS": memberStatuses.map((item) => item.label),
  "MEMBERSHIP TYPE": memberTypes.map((item) => item.label),
  "SEX": ["Male", "Female", "Other"],
  "CIVIL STATUS": ["Single", "Married", "Widowed", "Separated", "Divorced"],
  "HIGHEST EDUCATIONAL ATTAINMENT": educationalAttainments,
  "BOD APPROVAL STATUS": ["pending", "approved"],
  ...Object.fromEntries([1, 2, 3].map((slot) => [`BENEFICIARY ${slot} ACTIVE`, ["YES", "NO"]])),
};
