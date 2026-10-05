import { cities, provinces, barangaysForCity } from "../../address/addressService";
import type { SpreadsheetRow } from "./excelWorkbook";
import { normalizeSentenceCase, normalizeWhitespace, sanitizeGovernmentId } from "../../utils/inputSanitizers";
import type { EmployeeInput } from "../../types/employee";
import type { MemberInput } from "../../types/member";
import type { EmploymentAssignmentInput } from "../../types/assignment";
import { employmentStatuses, employmentTypes, departments, positions } from "../../features/employees/data/employeeOptions";
import { memberStatuses, memberTypes } from "../../features/members/data/memberOptions";
import { religionAffiliations } from "../lookups/religionAffiliations";
import { educationalAttainments } from "../lookups/educationalAttainments";
import { spreadsheetDate } from "./spreadsheetDate";
import { employeeInputSchema } from "../validation/employeeSchema";
import { memberInputSchema } from "../validation/memberSchema";
import { createUuid } from "../../utils/createUuid";
import { EMPLOYMENT_STATUS, MEMBER_STATUS } from "../lookups/statuses";

export type ImportErrorType = "identity" | "date" | "contact" | "address" | "government_id" | "lookup" | "beneficiary" | "validation" | "scope" | "duplicate" | "save";
export type PersonImportRow = {
  rowNumber: number; personNumber: string; firstName: string; middleName: string; lastName: string; suffix: string;
  birthDate: string; mobile: string; email: string; address: string; barangay: string; city: string; province: string; postalCode: string;
  dateHired: string; membershipDate: string; errors: string[]; errorTypes: ImportErrorType[]; linkedRecordId?: string;
  employeeFields: Partial<EmployeeInput>; memberFields: Partial<MemberInput>; assignmentFields: Partial<EmploymentAssignmentInput>; source?: SpreadsheetRow;
};
export type PersonImportOutcome = { rowNumber: number; status: "imported" | "error"; message: string; errorType?: ImportErrorType; recordId?: string };
type Lookup = { id: string; label: string };
export type PersonImportLookups = { departments: readonly Lookup[]; positions: readonly (Lookup & { departmentId: string })[] };

export async function personRowsFromSpreadsheet(rows: SpreadsheetRow[], kind: "employee" | "member" = "employee", lookups: PersonImportLookups = { departments, positions }): Promise<PersonImportRow[]> {
  if (!rows.length) throw new Error("The worksheet does not contain data rows.");
  const missing = ["FIRST NAME", "LAST NAME"].filter((header) => !(header in rows[0]));
  if (missing.length) throw new Error(`Missing required headers: ${missing.join(", ")}.`);
  const idCounts = new Map<string, number>();
  rows.forEach((row) => { const id = (row.ID || row["MEMBER ID"] || row["EMPLOYEE ID"] || "").trim().padStart(6, "0"); if (id !== "000000") idCounts.set(id, (idCounts.get(id) ?? 0) + 1); });
  return Promise.all(rows.map(async (originalRow, index) => {
    const row = Object.fromEntries(Object.entries(originalRow).map(([key, value]) => [key, normalizeWhitespace(value)])) as SpreadsheetRow;
    const errors: string[] = []; const errorTypes: ImportErrorType[] = [];
    const fail = (type: ImportErrorType, message: string) => { errors.push(message); if (!errorTypes.includes(type)) errorTypes.push(type); };
    const rawNumber = row.ID || row["MEMBER ID"] || row["EMPLOYEE ID"] || "";
    const number = rawNumber ? rawNumber.padStart(6, "0") : "";
    if (rawNumber && (!/^\d{1,6}$/.test(rawNumber) || Number(rawNumber) === 0)) fail("identity", "ID must contain 1 to 6 digits and cannot be zero.");
    if (number && (idCounts.get(number) ?? 0) > 1) fail("duplicate", "ID is duplicated in this workbook.");
    const date = (header: string) => {
      const parsed = spreadsheetDate(row[header]);
      if (parsed === null) fail("date", `${header}: enter an Excel date, YYYY-MM-DD or MM/DD/YYYY.`);
      return parsed ?? row[header] ?? "";
    };
    const lookup = (header: string, options: readonly Lookup[], fallback: string | null = null) => {
      if (!row[header]) return fallback;
      const found = options.find((item) => item.id === row[header] || item.label.toLowerCase() === row[header].toLowerCase());
      if (!found) fail("lookup", `${header} is not in the available list.`);
      return found?.id ?? null;
    };
    const identifier = (header: string, governmentKind: "sss" | "pagibig" | "philhealth" | "tin") => {
      if (!row[header]) return null;
      if (!/^[\d -]+$/.test(row[header])) { fail("government_id", `${header} contains invalid characters.`); return row[header]; }
      const lengths = governmentKind === "sss" ? [9] : governmentKind === "tin" ? [9, 12] : [12];
      if (!lengths.includes(row[header].replace(/\D/g, "").length)) { fail("government_id", `${header} must contain ${lengths.join(" or ")} digits.`); return row[header]; }
      return sanitizeGovernmentId(row[header], governmentKind);
    };
    const birthDate = date("BIRTH DATE"), dateHired = date("DATE HIRED"), membershipDate = date("MEMBERSHIP DATE");
    const common = {
      first_name: normalizeSentenceCase(row["FIRST NAME"] ?? ""), middle_name: normalizeSentenceCase(row["MIDDLE NAME"] ?? "") || null,
      last_name: normalizeSentenceCase(row["LAST NAME"] ?? ""), suffix: row.SUFFIX || null,
      date_of_birth: birthDate || null, sex: row.SEX || null, civil_status: row["CIVIL STATUS"] || null,
      mobile_number: row.MOBILE || null, email: row.EMAIL || null, address: row.ADDRESS || null,
      barangay: row.BARANGAY || null, city_municipality: row.CITY || row.MUNICIPALITY || null, province: row.PROVINCE || null, postal_code: row["POSTAL CODE"] || null,
      religion_affiliation_id: lookup("RELIGION / SOCIAL AFFILIATION", religionAffiliations),
      sss_number: identifier("SSS NUMBER", "sss"), pagibig_number: identifier("PAG-IBIG NUMBER", "pagibig"), philhealth_number: identifier("PHILHEALTH NUMBER", "philhealth"), tax_identification_number: identifier("TIN", "tin"),
      notes: row.NOTES || "Imported from Excel",
    };
    const beneficiaries = [1, 2, 3].flatMap((slot) => {
      const prefix = `BENEFICIARY ${slot} `;
      if (!["NAME", "RELATIONSHIP", "BIRTH DATE", "CONTACT NUMBER", "ACTIVE", "DEACTIVATION REASON"].some((field) => row[prefix + field])) return [];
      const active = (row[prefix + "ACTIVE"] || "YES").toUpperCase();
      if (!["YES", "NO", "TRUE", "FALSE", "1", "0"].includes(active)) fail("beneficiary", `${prefix}ACTIVE must be YES or NO.`);
      return [{ id: createUuid(), full_name: normalizeSentenceCase(row[prefix + "NAME"] || ""), relationship: row[prefix + "RELATIONSHIP"] || "", date_of_birth: date(prefix + "BIRTH DATE") || null, contact_number: row[prefix + "CONTACT NUMBER"] || null, is_active: ["YES", "TRUE", "1"].includes(active), deactivation_reason: row[prefix + "DEACTIVATION REASON"] || null }];
    });
    const employeeFields: Partial<EmployeeInput> = { ...common, beneficiaries, employment_status_id: lookup("EMPLOYMENT STATUS", employmentStatuses, EMPLOYMENT_STATUS.active), employment_type_id: lookup("EMPLOYMENT TYPE", employmentTypes, employmentTypes[1].id), date_hired: dateHired || null, date_regularized: date("DATE REGULARIZED") || null, date_separated: date("DATE SEPARATED") || null, department_id: lookup("DEPARTMENT", lookups.departments), position_id: lookup("POSITION", lookups.positions), supervisor_id: row["SUPERVISOR ID"] || null, work_location: row["WORK LOCATION"] || null };
    if (employeeFields.position_id && employeeFields.department_id && !lookups.positions.some((item) => item.id === employeeFields.position_id && item.departmentId === employeeFields.department_id)) fail("lookup", "POSITION does not belong to DEPARTMENT.");
    const annualIncome = row["ANNUAL INCOME"] ? Number(row["ANNUAL INCOME"].replace(/,/g, "")) : null;
    const education = row["HIGHEST EDUCATIONAL ATTAINMENT"] ? educationalAttainments.find((item) => item.toLowerCase() === row["HIGHEST EDUCATIONAL ATTAINMENT"].toLowerCase()) : null;
    if (row["HIGHEST EDUCATIONAL ATTAINMENT"] && !education) fail("lookup", "HIGHEST EDUCATIONAL ATTAINMENT is not in the available list.");
    const approval = (row["BOD APPROVAL STATUS"] || "pending").toLowerCase();
    const memberFields: Partial<MemberInput> = { ...common, beneficiaries, membership_date: membershipDate || null, membership_status_id: lookup("MEMBERSHIP STATUS", memberStatuses, MEMBER_STATUS.inactive), membership_type_id: lookup("MEMBERSHIP TYPE", memberTypes, memberTypes[1].id), member_category: row["MEMBER CATEGORY"] || null, highest_educational_attainment: education || null, occupation_income_source: row["OCCUPATION / INCOME SOURCE"] || "Employed / Salary", annual_income: annualIncome, termination_date: date("TERMINATION DATE") || null, termination_reason: row["TERMINATION REASON"] || null, emergency_contact: row["EMERGENCY CONTACT"] || null, bod_approval_status: approval as MemberInput["bod_approval_status"], acceptance_date: date("ACCEPTANCE DATE") || null, acceptance_resolution_number: row["BOD RESOLUTION NUMBER"]?.padStart(6, "0") || null, profile_photo_ref: row["PROFILE PHOTO REFERENCE"] || null, number_of_dependents: beneficiaries.filter((item) => item.is_active).length, beneficiary_name: beneficiaries.map((item) => item.full_name).join(", ") || null, religion_affiliation: row["RELIGION / SOCIAL AFFILIATION"] || null };
    const assignmentFields: Partial<EmploymentAssignmentInput> = { assignment_code: row["ASSIGNMENT CODE"] || null, start_date: date("ASSIGNMENT START DATE") || dateHired || new Date().toISOString().slice(0, 10), end_date: date("ASSIGNMENT END DATE") || null, notes: row["ASSIGNMENT NOTES"] || null, work_location: employeeFields.work_location || null };
    const province = provinces.find((item) => item.name.toUpperCase() === row.PROVINCE?.toUpperCase());
    if (row.PROVINCE && !province) fail("address", "Province is not in the official address file.");
    const city = cities.find((item) => item.name.toUpperCase() === (row.CITY || row.MUNICIPALITY)?.toUpperCase() && (!province || item.provinceCode === province.code));
    if ((row.CITY || row.MUNICIPALITY) && !city) fail("address", "City/municipality does not belong to the selected province.");
    if (city?.provinceCode && !province) fail("address", "Select the city's province from the official address file.");
    if (row.BARANGAY && !city) fail("address", "Barangay requires a valid city/municipality.");
    if (row.BARANGAY && city && !(await barangaysForCity(city.code)).some((item) => item.name.toUpperCase() === row.BARANGAY.toUpperCase())) fail("address", "Barangay does not belong to the selected city/municipality.");
    const validation = kind === "employee"
      ? employeeInputSchema.safeParse({ ...employeeFields, employee_number: number || "000001", member_id: null, date_hired: dateHired || new Date().toISOString().slice(0, 10), active_assignment: null })
      : memberInputSchema.safeParse({ ...memberFields, membership_number: number || "000001" });
    if (!validation.success) for (const issue of validation.error.issues) {
      const field = String(issue.path[0]);
      fail(field === "beneficiaries" ? "beneficiary" : ["sss_number", "pagibig_number", "philhealth_number", "tax_identification_number"].includes(field) ? "government_id" : /email|mobile/.test(field) ? "contact" : /date_/.test(field) ? "date" : /name/.test(field) ? "identity" : "validation", issue.message);
    }
    const today = new Date().toISOString().slice(0, 10);
    if (birthDate && birthDate > today) fail("date", "Birth date cannot be later than today.");
    if (assignmentFields.start_date && assignmentFields.end_date && assignmentFields.end_date < assignmentFields.start_date) fail("date", "Assignment end date cannot precede its start date.");
    return { rowNumber: index + 2, personNumber: number, firstName: common.first_name, middleName: common.middle_name || "", lastName: common.last_name, suffix: common.suffix || "", birthDate, mobile: row.MOBILE || "", email: row.EMAIL || "", address: row.ADDRESS || "", barangay: row.BARANGAY || "", city: row.CITY || row.MUNICIPALITY || "", province: row.PROVINCE || "", postalCode: row["POSTAL CODE"] || "", dateHired, membershipDate, errors, errorTypes, employeeFields, memberFields, assignmentFields, source: { ...originalRow } };
  }));
}
