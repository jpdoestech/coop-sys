import { useWorkspaceDialog, WorkspaceBreadcrumbs } from "../layout/WorkspaceNavigation";
import { useState } from "react";
import { AlertTriangle, LoaderCircle, Save, Search, X } from "lucide-react";
import type { SpreadsheetRow } from "../../services/imports/excelWorkbook";
import type { PersonImportRow } from "../../services/imports/personImport";
import { personImportHeaders } from "../../services/imports/personImportTemplate";
import { useUnsavedChanges } from "./unsavedChanges";
import { importErrorLabels, importFieldCategory } from "../../services/imports/personImportErrors";
import { personFieldOptions } from "../../services/imports/personFieldOptions";
import { ReligionAffiliationField } from "./ReligionAffiliationField";
import { EmploymentClassificationFields } from "./EmploymentClassificationFields";
import { SearchableSelect } from "../ui/SearchableSelect";
import { useOrganization } from "../../services/organization/useOrganization";
import { resolveEmploymentClassification } from "../../services/organization/employmentClassification";
import { spreadsheetDate } from "../../services/imports/spreadsheetDate";
import { GovernmentIdFields } from "./GovernmentIdFields";
import { normalizeProperCase } from "../../utils/inputSanitizers";

export function PersonImportRowEditor({ row, kind, onSave, onClose }: { row: PersonImportRow; kind: "employee" | "member"; onSave: (source: SpreadsheetRow) => Promise<void>; onClose: () => void }) {
  useWorkspaceDialog(`Edit Row ${row.rowNumber}`, onClose);
  const [draft, setDraft] = useState<SpreadsheetRow>(() => ({ ...row.source }));
  const directory = useOrganization();
  const attention = row.employeeFields.import_attention || row.memberFields.import_attention || {};
  const classification = resolveEmploymentClassification(draft.DEPARTMENT || "", draft.POSITION || "", directory.departments, directory.positions);
  const [filter, setFilter] = useState("all"), [search, setSearch] = useState(""), [saving, setSaving] = useState(false), [error, setError] = useState("");
  const { confirmDiscard: confirmLeave } = useUnsavedChanges(JSON.stringify(draft) !== JSON.stringify(row.source || {}), saving);
  const fields = [...new Set([...personImportHeaders(kind), ...Object.keys(draft)])];
  const categories = row.errorTypes;
  const governmentHeaders = ["SSS NUMBER", "PAG-IBIG NUMBER", "PHILHEALTH NUMBER", "TIN"];
  const visible = fields.filter((header) => (filter === "all" || (filter === "attention" ? header in attention : filter === "errors" ? categories.includes(importFieldCategory(header)) || (header === "ID" && categories.includes("duplicate")) : importFieldCategory(header) === filter)) && header.toLowerCase().includes(search.toLowerCase()));
  async function save() {
    setSaving(true); setError("");
    try {
      const source = { ...draft };
      ["ID", "MEMBER ID", "EMPLOYEE ID"].forEach((key) => { if (row.source && key in row.source) source[key] = row.source[key]; else delete source[key]; });
      await onSave(source); onClose();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "The correction could not be validated."); } finally { setSaving(false); }
  }
  return <div className="fixed inset-0 z-[80] flex items-center justify-center bg-ink/50 p-2 sm:p-3"><section role="dialog" aria-modal="true" aria-labelledby="row-editor-title" className="flex h-[min(740px,92dvh)] w-full max-w-4xl flex-col overflow-hidden rounded-md bg-white shadow-2xl"><header className="flex shrink-0 items-center justify-between border-b border-line px-4 py-3"><div className="min-w-0 flex-1"><WorkspaceBreadcrumbs dialog /><h3 id="row-editor-title" className="sr-only">Edit import row {row.rowNumber}</h3></div><button className="icon-button" type="button" aria-label="Close row editor" disabled={saving} onClick={() => confirmLeave(onClose)}><X className="h-4 w-4" /></button></header>
    <div className="flex shrink-0 flex-wrap gap-2 border-b border-line p-3"><label className="relative min-w-0 flex-1"><Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/40" /><input aria-label="Search imported fields" className="compact-control w-full pl-8" placeholder="Search fields" value={search} onChange={(e) => setSearch(e.target.value)} /></label><SearchableSelect aria-label="Filter imported fields" className="compact-control max-w-full" value={filter} onChange={(e) => setFilter(e.target.value)}><option value="all">All fields</option><option value="errors">Error categories</option><option value="attention">Needs attention</option>{Object.entries(importErrorLabels).filter(([id]) => !["scope", "duplicate", "save"].includes(id)).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</SearchableSelect></div>
    <div className="min-h-0 flex-1 overflow-auto p-3 sm:p-4">{row.errors.length ? <div className="mb-3 rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700"><p className="mb-1 flex items-center gap-1 font-semibold"><AlertTriangle className="h-4 w-4" />Validation issues</p>{row.errors.map((issue, i) => <p key={i}>{issue}</p>)}</div> : null}{row.warnings?.length ? <div className="mb-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900"><strong>Needs attention</strong>{row.warnings.map((issue, i) => <p key={i}>{issue}</p>)}</div> : null}<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
{visible.includes("DEPARTMENT") || visible.includes("POSITION") ? <EmploymentClassificationFields value={classification} disabled={saving} onChange={(value) => setDraft((current) => ({ ...current, DEPARTMENT: directory.departments.find((item) => item.id === value.department_id)?.label || value.pending_department_name || value.department_id || "", POSITION: directory.positions.find((item) => item.id === value.position_id)?.label || value.pending_position_name || value.position_id || "" }))} /> : null}
{visible.some((header) => governmentHeaders.includes(header)) ? <GovernmentIdFields disabled={saving} value={{ sss_number: draft["SSS NUMBER"] || null, pagibig_number: draft["PAG-IBIG NUMBER"] || null, philhealth_number: draft["PHILHEALTH NUMBER"] || null, tax_identification_number: draft.TIN || null }} onChange={(value) => setDraft((current) => ({ ...current, "SSS NUMBER": value.sss_number || "", "PAG-IBIG NUMBER": value.pagibig_number || "", "PHILHEALTH NUMBER": value.philhealth_number || "", TIN: value.tax_identification_number || "" }))} /> : null}
{visible.filter((header) => !["DEPARTMENT", "POSITION", ...governmentHeaders].includes(header)).map((header) => {
 const value = draft[header] || "", options = personFieldOptions[header];
 const readOnly = ["ID", "MEMBER ID", "EMPLOYEE ID"].includes(header);
 const classes = `compact-control mt-1 w-full ${header in attention ? "border-amber-400 bg-amber-50" : categories.includes(importFieldCategory(header)) ? "border-red-300" : ""}`;
 const set = (text: string) => setDraft((current) => ({ ...current, [header]: text }));
 if (header === "RELIGION / SOCIAL AFFILIATION") return <ReligionAffiliationField key={header} label={header} attention={header in attention} value={{ religion_affiliation: value }} disabled={saving} onChange={(value) => set(value.religion_affiliation || "")} />;
 return <label key={header} className="min-w-0 text-[11px] font-medium text-ink/65">{header}{options ? <SearchableSelect aria-label={header} className={classes} disabled={saving} value={value} onChange={(e) => set(e.target.value)} onCustomValue={set}><option value="">Not set</option>{value && !options.includes(value) ? <option value={value}>{value}</option> : null}{options.map((option) => <option key={option} value={option}>{option}</option>)}</SearchableSelect> : <input aria-label={header} className={classes} disabled={saving} readOnly={readOnly} aria-readonly={readOnly} placeholder={readOnly ? "Automatically generated" : undefined} type={header === "EMAIL" ? "email" : header.includes("DATE") && spreadsheetDate(value) !== null ? "date" : "text"} value={header.includes("DATE") ? spreadsheetDate(value) ?? value : value} onChange={(e) => { if (!readOnly) set(e.target.value); }} onBlur={(e) => { if (["FIRST NAME", "MIDDLE NAME", "LAST NAME"].includes(header) || /^BENEFICIARY [1-3] NAME$/.test(header)) set(normalizeProperCase(e.target.value)); }} inputMode={header === "MOBILE" || readOnly ? "numeric" : undefined} />}{header in attention ? <span className="mt-1 block text-[10px] text-amber-800">Needs attention</span> : null}</label>;
})}</div>{!visible.length ? <p className="py-8 text-center text-xs text-ink/50">No matching fields.</p> : null}{error ? <p role="alert" className="mt-3 text-xs text-red-700">{error}</p> : null}</div>
    <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-line p-3"><button type="button" className="secondary-button" disabled={saving} onClick={() => confirmLeave(onClose)}><X className="h-4 w-4" />Cancel</button><button type="button" className="primary-button" disabled={saving} onClick={() => void save()}>{saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{saving ? "Validating..." : "Apply correction"}</button></footer>
  </section></div>;
}
