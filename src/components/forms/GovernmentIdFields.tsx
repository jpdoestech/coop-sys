export type GovernmentIdValue = {
  sss_number: string | null;
  pagibig_number: string | null;
  philhealth_number: string | null;
  tax_identification_number: string | null;
};

type Props = {
  value: GovernmentIdValue;
  errors?: Partial<Record<keyof GovernmentIdValue, string>>;
  onChange: (value: GovernmentIdValue) => void;
};

const inputClass =
  "focus-ring mt-1.5 w-full rounded border border-line bg-white px-3 py-2.5 text-sm text-ink placeholder:text-ink/35";

export function GovernmentIdFields({ value, errors = {}, onChange }: Props) {
  function patch(next: Partial<GovernmentIdValue>) {
    onChange({ ...value, ...next });
  }

  return (
    <>
      <label className="block text-xs font-semibold text-ink/75">
        SSS number
        <input className={inputClass} inputMode="numeric" maxLength={12} pattern="[0-9-]*" value={value.sss_number ?? ""} onChange={(event) => patch({ sss_number: sanitizeGovernmentId(event.target.value, 12) || null })} placeholder="00-0000000-0" />
        {errors.sss_number ? <span className="mt-1 block text-xs font-normal text-red-700">{errors.sss_number}</span> : null}
      </label>
      <label className="block text-xs font-semibold text-ink/75">
        PAG-IBIG MID number
        <input className={inputClass} inputMode="numeric" maxLength={14} pattern="[0-9-]*" value={value.pagibig_number ?? ""} onChange={(event) => patch({ pagibig_number: sanitizeGovernmentId(event.target.value, 14) || null })} placeholder="0000-0000-0000" />
        {errors.pagibig_number ? <span className="mt-1 block text-xs font-normal text-red-700">{errors.pagibig_number}</span> : null}
      </label>
      <label className="block text-xs font-semibold text-ink/75">
        PhilHealth number
        <input className={inputClass} inputMode="numeric" maxLength={14} pattern="[0-9-]*" value={value.philhealth_number ?? ""} onChange={(event) => patch({ philhealth_number: sanitizeGovernmentId(event.target.value, 14) || null })} placeholder="00-000000000-0" />
        {errors.philhealth_number ? <span className="mt-1 block text-xs font-normal text-red-700">{errors.philhealth_number}</span> : null}
      </label>
      <label className="block text-xs font-semibold text-ink/75">
        TIN
        <input className={inputClass} inputMode="numeric" maxLength={15} pattern="[0-9-]*" value={value.tax_identification_number ?? ""} onChange={(event) => patch({ tax_identification_number: sanitizeGovernmentId(event.target.value, 15) || null })} placeholder="000-000-000-000" />
        {errors.tax_identification_number ? <span className="mt-1 block text-xs font-normal text-red-700">{errors.tax_identification_number}</span> : null}
      </label>
    </>
  );
}

import { sanitizeGovernmentId } from "../../utils/inputSanitizers";

