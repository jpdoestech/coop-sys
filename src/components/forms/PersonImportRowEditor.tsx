import { useState } from "react";
import { AlertTriangle, LoaderCircle, Save, Search, X } from "lucide-react";
import type { SpreadsheetRow } from "../../services/imports/excelWorkbook";
import type { PersonImportRow } from "../../services/imports/personImport";
import { personImportHeaders } from "../../services/imports/personImportTemplate";
import { useUnsavedChanges } from "./unsavedChanges";
import { importErrorLabels, importFieldCategory } from "../../services/imports/personImportErrors";

export function PersonImportRowEditor({ row, kind, onSave, onClose }: { row: PersonImportRow; kind: "employee" | "member"; onSave: (source: SpreadsheetRow) => Promise<void>; onClose: () => void }) {
  const [draft, setDraft] = useState<SpreadsheetRow>(() => ({ ...row.source }));
  const [filter, setFilter] = useState("all"), [search, setSearch] = useState(""), [saving, setSaving] = useState(false), [error, setError] = useState("");
  const { confirmDiscard: confirmLeave } = useUnsavedChanges(JSON.stringify(draft) !== JSON.stringify(row.source || {}), saving);
  const fields = [...new Set([...personImportHeaders(kind), ...Object.keys(draft)])];
  const categories = row.errorTypes;
  const visible = fields.filter((header) => (filter === "all" || (filter === "errors" ? categories.includes(importFieldCategory(header)) || (header === "ID" && categories.includes("duplicate")) : importFieldCategory(header) === filter)) && header.toLowerCase().includes(search.toLowerCase()));
  async function save() {
    setSaving(true); setError("");
    try { await onSave(draft); onClose(); } catch (reason) { setError(reason instanceof Error ? reason.message : "The correction could not be validated."); } finally { setSaving(false); }
  }
  return <div className="fixed inset-0 z-[80] flex items-center justify-center bg-ink/50 p-2 sm:p-3"><section role="dialog" aria-modal="true" aria-labelledby="row-editor-title" className="flex h-[min(740px,92dvh)] w-full max-w-4xl flex-col overflow-hidden rounded-md bg-white shadow-2xl"><header className="flex shrink-0 items-center justify-between border-b border-line px-4 py-3"><h3 id="row-editor-title" className="text-sm font-semibold">Edit import row {row.rowNumber}</h3><button className="icon-button" type="button" aria-label="Close row editor" disabled={saving} onClick={() => confirmLeave(onClose)}><X className="h-4 w-4" /></button></header>
    <div className="flex shrink-0 flex-wrap gap-2 border-b border-line p-3"><label className="relative min-w-0 flex-1"><Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/40" /><input aria-label="Search imported fields" className="compact-control w-full pl-8" placeholder="Search fields" value={search} onChange={(e) => setSearch(e.target.value)} /></label><select aria-label="Filter imported fields" className="compact-control max-w-full" value={filter} onChange={(e) => setFilter(e.target.value)}><option value="all">All fields</option><option value="errors">Error categories</option>{Object.entries(importErrorLabels).filter(([id]) => !["scope", "duplicate", "save"].includes(id)).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></div>
    <div className="min-h-0 flex-1 overflow-auto p-3 sm:p-4">{row.errors.length ? <div className="mb-3 rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700"><p className="mb-1 flex items-center gap-1 font-semibold"><AlertTriangle className="h-4 w-4" />Validation issues</p>{row.errors.map((issue, i) => <p key={i}>{issue}</p>)}</div> : null}<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{visible.map((header) => <label key={header} className="min-w-0 text-[11px] font-medium text-ink/65">{header}<input aria-label={header} className={`compact-control mt-1 w-full ${categories.includes(importFieldCategory(header)) ? "border-red-300" : ""}`} disabled={saving} value={draft[header] || ""} onChange={(e) => setDraft((current) => ({ ...current, [header]: e.target.value }))} inputMode={header === "MOBILE" || header === "ID" ? "numeric" : undefined} /></label>)}</div>{!visible.length ? <p className="py-8 text-center text-xs text-ink/50">No matching fields.</p> : null}{error ? <p role="alert" className="mt-3 text-xs text-red-700">{error}</p> : null}</div>
    <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-line p-3"><button type="button" className="secondary-button" disabled={saving} onClick={() => confirmLeave(onClose)}><X className="h-4 w-4" />Cancel</button><button type="button" className="primary-button" disabled={saving} onClick={() => void save()}>{saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{saving ? "Validating..." : "Apply correction"}</button></footer>
  </section></div>;
}
