import { Plus, RotateCcw, UserMinus } from "lucide-react";
import type { BeneficiaryInput } from "../../types/beneficiary";
import { activeBeneficiaryCount } from "../../types/beneficiary";
import { CHARACTER_LIMITS, sanitizePhoneNumber } from "../../utils/inputSanitizers";

type BeneficiaryEditorProps = {
  value: BeneficiaryInput[];
  onChange: (value: BeneficiaryInput[]) => void;
};

const inputClass = "compact-control w-full disabled:bg-line/20";

export function BeneficiaryEditor({ value, onChange }: BeneficiaryEditorProps) {
  const activeCount = activeBeneficiaryCount(value);

  function update(id: string, patch: Partial<BeneficiaryInput>) {
    onChange(value.map((beneficiary) => beneficiary.id === id ? { ...beneficiary, ...patch } : beneficiary));
  }

  function add() {
    if (activeCount >= 3) return;
    onChange([...value, {
      id: crypto.randomUUID(), full_name: "", relationship: "", date_of_birth: null,
      contact_number: null, is_active: true, deactivation_reason: null,
    }]);
  }

  return (
    <div className="sm:col-span-2">
      <div className="mb-3 flex items-center justify-between gap-4">
        <p className="text-xs text-ink/60"><span className="font-semibold text-ink">{activeCount} of 3</span> active beneficiaries</p>
        <button type="button" disabled={activeCount >= 3} onClick={add} className="focus-ring inline-flex h-9 items-center gap-1.5 rounded-md border border-line bg-white px-3 text-xs font-semibold text-ink hover:border-moss disabled:cursor-not-allowed disabled:opacity-45"><Plus className="h-3.5 w-3.5" /> Add beneficiary</button>
      </div>
      <div className="divide-y divide-line border-y border-line">
        {!value.length ? <p className="py-5 text-sm text-ink/55">No beneficiaries entered.</p> : null}
        {value.map((beneficiary, index) => (
          <div key={beneficiary.id} className={`py-3 ${beneficiary.is_active ? "" : "opacity-70"}`}>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase text-clay">Beneficiary {index + 1}{beneficiary.is_active ? "" : " - inactive"}</p>
              {beneficiary.is_active ? <button type="button" onClick={() => update(beneficiary.id, { is_active: false })} className="focus-ring inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-50"><UserMinus className="h-3.5 w-3.5" /> Deactivate</button> : <button type="button" disabled={activeCount >= 3} onClick={() => update(beneficiary.id, { is_active: true, deactivation_reason: null })} className="focus-ring inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-semibold text-moss hover:bg-emerald-50 disabled:opacity-45"><RotateCcw className="h-3.5 w-3.5" /> Reactivate</button>}
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <input className={inputClass} disabled={!beneficiary.is_active} value={beneficiary.full_name} onChange={(event) => update(beneficiary.id, { full_name: event.target.value })} placeholder="Full name" aria-label={`Beneficiary ${index + 1} full name`} />
              <input className={inputClass} disabled={!beneficiary.is_active} value={beneficiary.relationship} onChange={(event) => update(beneficiary.id, { relationship: event.target.value })} placeholder="Relationship" aria-label={`Beneficiary ${index + 1} relationship`} />
              <input type="date" className={inputClass} disabled={!beneficiary.is_active} value={beneficiary.date_of_birth ?? ""} onChange={(event) => update(beneficiary.id, { date_of_birth: event.target.value || null })} aria-label={`Beneficiary ${index + 1} date of birth`} />
              <input className={inputClass} inputMode="tel" maxLength={CHARACTER_LIMITS.phone} disabled={!beneficiary.is_active} value={beneficiary.contact_number ?? ""} onChange={(event) => update(beneficiary.id, { contact_number: sanitizePhoneNumber(event.target.value) || null })} placeholder="Contact number" aria-label={`Beneficiary ${index + 1} contact number`} />
              {!beneficiary.is_active ? <input className={`${inputClass} sm:col-span-2`} value={beneficiary.deactivation_reason ?? ""} onChange={(event) => update(beneficiary.id, { deactivation_reason: event.target.value || null })} placeholder="Reason for deactivation (required)" aria-label={`Beneficiary ${index + 1} deactivation reason`} /> : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
