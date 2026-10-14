import type { PayrollKind } from "../../types/payroll";
import { payrollLabels } from "./payrollLabels";

export function PayrollNavigation({ view, kind, onView, onKind }: {
  view: "runs" | "attendance" | "settings";
  kind: PayrollKind;
  onView: (view: "runs" | "attendance" | "settings") => void;
  onKind: (kind: PayrollKind) => void;
}) {
  return <>
    <nav aria-label="Payroll views" className="flex flex-wrap items-center gap-1 border-b border-line px-2">
      {(["runs", "attendance", "settings"] as const).map((value) => <button type="button" key={value} aria-current={view === value ? "page" : undefined} className={`h-10 border-b-2 px-3 text-xs font-semibold ${view === value ? "border-moss text-moss" : "border-transparent text-ink/55"}`} onClick={() => onView(value)}>
        {{ runs: "Payroll Runs", attendance: "Attendance Review", settings: "Settings" }[value]}
      </button>)}
    </nav>
    {view === "settings" ? <div className="border-b border-line px-3 py-2"><label className="field-label flex flex-wrap items-center gap-2">Payroll settings<select className="compact-control w-full sm:w-60" value={kind} onChange={(event) => onKind(event.target.value as PayrollKind)}>
      {(Object.keys(payrollLabels) as PayrollKind[]).map((value) => <option key={value} value={value}>{payrollLabels[value]}</option>)}
    </select></label></div> : null}
  </>;
}
