import { SearchableSelect } from "../ui/SearchableSelect";
import { religionAffiliations } from "../../services/lookups/religionAffiliations";

export function ReligionAffiliationField({ value, onChange, disabled, label = "Religion / social affiliation", attention = false }: { value: { religion_affiliation_id?: string | null; religion_affiliation?: string | null }; onChange: (value: { religion_affiliation_id: string | null; religion_affiliation: string | null }) => void; disabled?: boolean; label?: string; attention?: boolean }) {
  const known = religionAffiliations.find((item) => item.id === value.religion_affiliation_id);
  const custom = !known ? value.religion_affiliation : null;
  return <div className="min-w-0"><span className="block text-xs font-semibold text-ink/75">{label}</span><SearchableSelect aria-label={label} className={`control mt-1.5 w-full ${attention ? "border-amber-400 bg-amber-50" : ""}`} disabled={disabled} value={known?.id || (custom ? "custom" : "")} onChange={(event) => { const found = religionAffiliations.find((item) => item.id === event.target.value); onChange({ religion_affiliation_id: found?.id || null, religion_affiliation: found?.label || (event.target.value === "custom" ? custom || null : null) }); }} onCustomValue={(text) => onChange({ religion_affiliation_id: null, religion_affiliation: text })}><option value="">Not set</option>{custom ? <option value="custom">{custom}</option> : null}{religionAffiliations.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</SearchableSelect></div>;
}
