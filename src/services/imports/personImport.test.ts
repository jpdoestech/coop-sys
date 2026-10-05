import { describe, expect, it } from "vitest";
import { personRowsFromSpreadsheet } from "./personImport";
import { departments, positions } from "../../features/employees/data/employeeOptions";

describe("person import validation", () => {
  it("accepts unmatched lookup values and persists review flags without weakening email or ID validation", async () => {
    const [row] = await personRowsFromSpreadsheet([{ "FIRST NAME": "Review", "LAST NAME": "Person", EMAIL: "invalid-email", DEPARTMENT: "New division", POSITION: "New role", "EMPLOYMENT TYPE": "Custom contract", "RELIGION / SOCIAL AFFILIATION": "Custom affiliation", "HIGHEST EDUCATIONAL ATTAINMENT": "Custom education" }]);
    expect(row.errorTypes).toContain("contact");
    expect(row.errorTypes).not.toContain("lookup");
    expect(row.employeeFields).toMatchObject({ pending_department_name: "New division", pending_position_name: "New role", religion_affiliation: "Custom affiliation", import_attention: { DEPARTMENT: "New division", POSITION: "New role", "EMPLOYMENT TYPE": "Custom contract" } });
    expect(row.memberFields.highest_educational_attainment).toBe("Custom education");
    const [corrected] = await personRowsFromSpreadsheet([{ ...row.source, EMAIL: "review@example.test" }]);
    expect(corrected.errors).toEqual([]);
    expect(corrected.warnings?.length).toBeGreaterThan(0);
  });
  it("blocks duplicate full names, government IDs and case-insensitive emails", async () => {
    const rows = await personRowsFromSpreadsheet([{ "FIRST NAME": "JUAN", "LAST NAME": "CRUZ", EMAIL: "juan@example.test", "SSS NUMBER": "123456789" }, { "FIRST NAME": " Juan ", "LAST NAME": "Cruz", EMAIL: "JUAN@example.test", "SSS NUMBER": "12-345678-9" }]);
    rows.forEach((row) => expect(row.errorTypes).toEqual(expect.arrayContaining(["duplicate", "contact", "government_id"])));
  });
  it("maps the complete employee record, government IDs and three beneficiaries", async () => {
    const [row] = await personRowsFromSpreadsheet([{ ID: "19", "FIRST NAME": "  JUAN   CARLOS ", "LAST NAME": "DELA CRUZ", SUFFIX: "III", "BIRTH DATE": "6/15/1990", "DATE HIRED": "45292", MOBILE: "09171234567", ADDRESS: "Full free-text address", "SEX": "Male", "CIVIL STATUS": "Single", "SSS NUMBER": "123456789", "PAG-IBIG NUMBER": "123456789012", "TIN": "123456789", "RELIGION / SOCIAL AFFILIATION": "Roman Catholic", DEPARTMENT: departments[0].label, POSITION: positions[0].label, "WORK LOCATION": "Test site", "ASSIGNMENT CODE": "A-1", "ASSIGNMENT START DATE": "1/2/2024", "BENEFICIARY 1 NAME": "JANE CRUZ", "BENEFICIARY 1 RELATIONSHIP": "Spouse", "BENEFICIARY 1 BIRTH DATE": "1990-01-01", "BENEFICIARY 2 NAME": "JOHN CRUZ", "BENEFICIARY 2 RELATIONSHIP": "Child", "BENEFICIARY 3 NAME": "JUNE CRUZ", "BENEFICIARY 3 RELATIONSHIP": "Child" }]);
    expect(row.errors).toEqual([]);
    expect(row).toMatchObject({ personNumber: "000019", firstName: "Juan carlos", suffix: "III", birthDate: "1990-06-15", dateHired: "2024-01-01" });
    expect(row.employeeFields).toMatchObject({ sss_number: "12-345678-9", pagibig_number: "1234-5678-9012", tax_identification_number: "123-456-789", department_id: departments[0].id, position_id: positions[0].id, address: "Full free-text address" });
    expect(row.employeeFields.beneficiaries).toHaveLength(3);
    expect(row.assignmentFields).toMatchObject({ start_date: "2024-01-02", assignment_code: "A-1" });
  });
  it("categorizes invalid dates, contact, duplicates and overlong IDs without silently truncating", async () => {
    const rows = await personRowsFromSpreadsheet([{ ID: "1", "FIRST NAME": "Mira", "LAST NAME": "Flores", "BIRTH DATE": "2026-02-30", MOBILE: "123", "SSS NUMBER": "1234567890" }, { ID: "000001", "FIRST NAME": "Other", "LAST NAME": "Employee" }]);
    expect(rows[0].errorTypes).toEqual(expect.arrayContaining(["duplicate", "date", "government_id", "contact"]));
    expect(rows[0].employeeFields.sss_number).toBe("1234567890");
    expect(rows[1].errorTypes).toContain("duplicate");
  });
  it("maps membership approval and financial fields with Associate as the default", async () => {
    const [row] = await personRowsFromSpreadsheet([{ "FIRST NAME": "Mira", "LAST NAME": "Flores", "MEMBERSHIP DATE": "1/15/2025", "ANNUAL INCOME": "240,000", "HIGHEST EDUCATIONAL ATTAINMENT": "College level", "BOD APPROVAL STATUS": "approved", "ACCEPTANCE DATE": "1/20/2025", "BOD RESOLUTION NUMBER": "12" }], "member");
    expect(row.errors).toEqual([]);
    expect(row.memberFields).toMatchObject({ membership_type_id: "30000000-0000-4000-8000-000000000002", membership_date: "2025-01-15", annual_income: 240000, acceptance_resolution_number: "000012", acceptance_date: "2025-01-20" });
  });
});
