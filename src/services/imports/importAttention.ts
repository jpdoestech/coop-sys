export type ImportAttention = Record<string, string>;
export const attentionHeaderForField: Record<string, string> = {
  sex: "SEX", civil_status: "CIVIL STATUS", highest_educational_attainment: "HIGHEST EDUCATIONAL ATTAINMENT",
  employment_status_id: "EMPLOYMENT STATUS", employment_type_id: "EMPLOYMENT TYPE", membership_status_id: "MEMBERSHIP STATUS", membership_type_id: "MEMBERSHIP TYPE",
  religion_affiliation_id: "RELIGION / SOCIAL AFFILIATION", department_id: "DEPARTMENT", position_id: "POSITION",
  province: "PROVINCE", city_municipality: "CITY", barangay: "BARANGAY",
};

export function hasImportAttention(record: { import_attention?: ImportAttention | null; pending_department_name?: string | null; pending_position_name?: string | null }) {
  return Boolean(Object.keys(record.import_attention || {}).length || record.pending_department_name || record.pending_position_name);
}

export function clearImportAttention(attention: ImportAttention | null | undefined, ...headers: string[]): ImportAttention | null {
  const next = { ...attention };
  headers.forEach((header) => delete next[header]);
  return Object.keys(next).length ? next : null;
}
