import columns from "./personImportColumns.json";
import { employmentStatuses, employmentTypes } from "../../features/employees/data/employeeOptions";
import { memberStatuses, memberTypes } from "../../features/members/data/memberOptions";
import { religionAffiliations } from "../lookups/religionAffiliations";
import { educationalAttainments } from "../lookups/educationalAttainments";
import type { PersonImportLookups } from "./personImport";

export function personImportHeaders(kind: "member" | "employee") {
  return [...columns.common, ...columns[kind], ...[1, 2, 3].flatMap((slot) => columns.beneficiary.map((field) => `BENEFICIARY ${slot} ${field}`))];
}

export async function createPersonImportTemplate(kind: "member" | "employee", lookups: PersonImportLookups) {
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(kind === "member" ? "MEMBERS" : "EMPLOYEES", { views: [{ state: "frozen", xSplit: 4, ySplit: 1 }] });
  const headers = personImportHeaders(kind);
  sheet.addRow(headers);
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: headers.length } };
  sheet.getRow(1).height = 42;
  const options: Record<string, readonly string[]> = {
    "SEX": ["Male", "Female"], "CIVIL STATUS": ["Single", "Married", "Widowed", "Separated", "Divorced"],
    "EMPLOYMENT STATUS": employmentStatuses.map((item) => item.label), "EMPLOYMENT TYPE": employmentTypes.map((item) => item.label),
    "MEMBERSHIP STATUS": memberStatuses.map((item) => item.label), "MEMBERSHIP TYPE": memberTypes.map((item) => item.label),
    "DEPARTMENT": lookups.departments.map((item) => item.label), "POSITION": lookups.positions.map((item) => item.label),
    "RELIGION / SOCIAL AFFILIATION": religionAffiliations.map((item) => item.label), "HIGHEST EDUCATIONAL ATTAINMENT": educationalAttainments,
    "BOD APPROVAL STATUS": ["pending", "approved"],
    ...Object.fromEntries([1, 2, 3].map((slot) => [`BENEFICIARY ${slot} ACTIVE`, ["YES", "NO"]])),
  };
  const lists = workbook.addWorksheet("LOOKUPS");
  Object.entries(options).forEach(([header, values], index) => {
    lists.getCell(1, index + 1).value = header;
    values.forEach((value, row) => { lists.getCell(row + 2, index + 1).value = value; });
    const letter = lists.getColumn(index + 1).letter;
    if (values.length) workbook.definedNames.add(`LOOKUPS!$${letter}$2:$${letter}$${values.length + 1}`, `ImportList${index}`);
    lists.getColumn(index + 1).width = 32;
  });
  headers.forEach((header, index) => {
    const column = sheet.getColumn(index + 1);
    column.width = header === "ADDRESS" || header === "NOTES" ? 36 : 24;
    column.numFmt = header.includes("DATE") ? "yyyy-mm-dd" : "@";
    const cell = sheet.getCell(1, index + 1);
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF247253" } };
    cell.alignment = { wrapText: true, vertical: "middle" };
    cell.note = header.includes("DATE") ? "Excel dates, YYYY-MM-DD, MM/DD/YYYY and Excel date serials are supported. Text dates use month/day/year."
      : header === "ADDRESS" ? "Enter the complete free-text address here. It is saved in the street/address field for later completion."
      : header === "SUPERVISOR ID" ? "Optional existing six-digit employee ID within your permitted scope."
      : header === "ID" ? "Optional shared member/employee ID: up to six digits. Leave blank to generate a new ID."
      : header === "MOBILE" ? "Optional 11-digit mobile number starting with 09. Keep it as text to preserve the leading zero."
      : "FIRST NAME LAST NAME".includes(header) ? "Required. Extra spaces are trimmed and names use sentence case."
      : "Optional. Blank fields use the system default where applicable.";
    const listIndex = Object.keys(options).indexOf(header);
    if (listIndex >= 0 && options[header].length) for (let row = 2; row <= 501; row += 1) sheet.getCell(row, index + 1).dataValidation = { type: "list", allowBlank: true, formulae: [`ImportList${listIndex}`], showErrorMessage: false, showInputMessage: true, promptTitle: "Suggested values", prompt: "Choose a suggestion or type another value. Unmatched values are accepted and marked Needs attention." };
  });
  const guide = workbook.addWorksheet("IMPORT GUIDE");
  guide.addRows([
    ["Import rule", "Details"],
    ["Deployment", "Select the branch and client in the import window before uploading. The selected deployment applies to the batch; access scope is enforced."],
    ["Required fields", "FIRST NAME and LAST NAME. ID is optional; do not add MEM or EMP prefixes."],
    ["Address", "Use ADDRESS for the complete free-text address. Official location fields can be completed later."],
    ["Dates", "Native Excel dates and serials, YYYY-MM-DD, MM/DD/YYYY, and named-month dates. Text dates use month/day/year; two-digit years and impossible dates are rejected."],
    ["Linked records", "Link an existing member/employee in the preview. Existing member identity takes priority when creating a linked employee."],
    ["Employment defaults", "Active / Probationary. Date hired defaults to today; assignment start defaults to date hired."],
    ["Membership defaults", "Associate / Pending approval / Employed-Salary. Approved records require an acceptance date, BOD number and approval permission."],
    ["Beneficiaries", "Up to three beneficiaries. ACTIVE defaults to YES; NO requires a deactivation reason."],
    ["Government IDs", "SSS: 9 digits; PAG-IBIG and PHILHEALTH: 12; TIN: 9 or 12. Dashes are formatted automatically; sensitive-data permission is required."],
    ["Lookup values", "Dropdowns are suggestions, not restrictions. Custom values are preserved and marked Needs attention before and after import. Department and position can be created from the entry/correction form when permitted."],
    ["Import results", "Only ready rows are submitted. Imported rows cannot be resubmitted in the same preview; errors remain available for review."],
  ]);
  guide.getColumn(1).width = 24; guide.getColumn(2).width = 100;
  guide.eachRow((row) => { row.alignment = { wrapText: true, vertical: "top" }; row.height = 42; });
  return workbook.xlsx.writeBuffer();
}

export async function downloadPersonImportTemplate(kind: "member" | "employee", lookups: PersonImportLookups) {
  const bytes = await createPersonImportTemplate(kind, lookups);
  const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = `${kind}_import_template.xlsx`; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
