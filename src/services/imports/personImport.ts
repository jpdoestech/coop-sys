import { cities, provinces, barangaysForCity } from "../../address/addressService";
import type { SpreadsheetRow } from "./excelWorkbook";

export type PersonImportRow = {
  rowNumber: number; personNumber: string; firstName: string; middleName: string; lastName: string; suffix: string;
  birthDate: string; mobile: string; email: string; address: string; barangay: string; city: string; province: string; postalCode: string;
  dateHired: string; membershipDate: string; errors: string[]; linkedRecordId?: string;
};

function validDate(value: string) { return !value || /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)); }

export async function personRowsFromSpreadsheet(rows: SpreadsheetRow[]): Promise<PersonImportRow[]> {
  const required = ["FIRST NAME", "LAST NAME"];
  const missing = required.filter((header) => !(header in rows[0]));
  if (missing.length) throw new Error(`Missing required headers: ${missing.join(", ")}.`);
  return Promise.all(rows.map(async (row, index) => {
    const errors: string[] = [];
    const number = (row.ID || row["MEMBER ID"] || row["EMPLOYEE ID"] || "").replace(/\D/g, "");
    if (number && number.length > 6) errors.push("ID must contain at most 6 digits.");
    if (!row["FIRST NAME"]?.trim()) errors.push("First name is required.");
    if (!row["LAST NAME"]?.trim()) errors.push("Last name is required.");
    if (row.EMAIL && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.EMAIL)) errors.push("Email is invalid.");
    if (row.MOBILE && !/^[0-9+() -]{7,20}$/.test(row.MOBILE)) errors.push("Mobile number is invalid.");
    for (const [label, value] of [["Birth date", row["BIRTH DATE"]], ["Date hired", row["DATE HIRED"]], ["Membership date", row["MEMBERSHIP DATE"]]] as const) if (!validDate(value ?? "")) errors.push(`${label} must use YYYY-MM-DD.`);
    const province = provinces.find((item) => item.name.toUpperCase() === row.PROVINCE?.trim().toUpperCase());
    if (row.PROVINCE && !province) errors.push("Province is not in the official address file.");
    const city = cities.find((item) => item.name.toUpperCase() === (row.CITY || row.MUNICIPALITY)?.trim().toUpperCase() && (!province || item.provinceCode === province.code));
    if ((row.CITY || row.MUNICIPALITY) && !city) errors.push("City/municipality does not belong to the selected province.");
    if (row.BARANGAY && city) { const barangays = await barangaysForCity(city.code); if (!barangays.some((item) => item.name.toUpperCase() === row.BARANGAY.trim().toUpperCase())) errors.push("Barangay does not belong to the selected city/municipality."); }
    return { rowNumber: index + 2, personNumber: number ? number.padStart(6, "0") : "", firstName: row["FIRST NAME"]?.trim() ?? "", middleName: row["MIDDLE NAME"]?.trim() ?? "", lastName: row["LAST NAME"]?.trim() ?? "", suffix: row.SUFFIX?.trim() ?? "", birthDate: row["BIRTH DATE"] ?? "", mobile: row.MOBILE ?? "", email: row.EMAIL ?? "", address: row.ADDRESS ?? "", barangay: row.BARANGAY ?? "", city: row.CITY || row.MUNICIPALITY || "", province: row.PROVINCE ?? "", postalCode: row["POSTAL CODE"] ?? "", dateHired: row["DATE HIRED"] ?? "", membershipDate: row["MEMBERSHIP DATE"] ?? "", errors };
  }));
}
