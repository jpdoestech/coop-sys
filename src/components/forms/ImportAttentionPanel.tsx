import { AlertTriangle, Check } from "lucide-react";
import { clearImportAttention, type ImportAttention } from "../../services/imports/importAttention";

export function ImportAttentionPanel({ value, onChange }: { value: ImportAttention | null | undefined; onChange: (value: ImportAttention | null) => void }) {
  if (!value || !Object.keys(value).length) return null;
  return <section className="mx-4 my-3 rounded-md border border-amber-300 bg-amber-50 p-3 sm:mx-8"><h3 className="flex items-center gap-2 text-xs font-semibold text-amber-900"><AlertTriangle className="h-4 w-4" />Needs attention</h3><ul className="mt-2 space-y-1">{Object.entries(value).map(([field, text]) => <li key={field} className="flex items-center justify-between gap-2 text-xs text-amber-900"><span className="min-w-0 break-words"><strong>{field}</strong>: {text || "Not mapped"}</span><button type="button" className="icon-button shrink-0" title={`Mark ${field} reviewed`} aria-label={`Mark ${field} reviewed`} onClick={() => onChange(clearImportAttention(value, field))}><Check className="h-4 w-4" /></button></li>)}</ul></section>;
}
