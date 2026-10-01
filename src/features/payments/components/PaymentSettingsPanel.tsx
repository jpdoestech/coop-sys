import { useState } from "react";
import { CalendarClock, Save } from "lucide-react";
import type { PaymentSettings } from "../../../types/payment";
import { formatPesos, pesosToCentavos } from "../../../services/payments/paymentMath";
import type { PaymentSettingsInput } from "../../../services/repositories/PaymentRepository";

export function PaymentSettingsPanel({ settings, saving, onSave }: { settings: PaymentSettings[]; saving: boolean; onSave: (input: PaymentSettingsInput) => void }) {
  const [fee, setFee] = useState("500");
  const [capital, setCapital] = useState("5000");
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().slice(0, 10));
  const [error, setError] = useState("");
  function submit(event: React.FormEvent) { event.preventDefault(); try { setError(""); onSave({ membership_fee_centavos: pesosToCentavos(fee), capital_share_target_centavos: pesosToCentavos(capital), effective_from: effectiveFrom }); } catch (reason) { setError(reason instanceof Error ? reason.message : "Invalid settings."); } }
  return <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_minmax(300px,0.8fr)]">
    <form onSubmit={submit} className="grid content-start gap-3 sm:grid-cols-2">
      <label className="field-label">Membership fee<input className="control mt-1" inputMode="decimal" value={fee} onChange={(e) => setFee(e.target.value)} /></label>
      <label className="field-label">Capital share target<input className="control mt-1" inputMode="decimal" value={capital} onChange={(e) => setCapital(e.target.value)} /></label>
      <label className="field-label">Date effectivity<input className="control mt-1" type="date" required value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} /></label>
      <div className="self-end rounded-md bg-emerald-50 px-3 py-2 text-xs text-moss"><CalendarClock className="mr-2 inline h-4 w-4" /> New settings preserve prior effective periods.</div>
      {error ? <p className="text-xs text-red-700 sm:col-span-2">{error}</p> : null}
      <button disabled={saving} className="primary-button w-fit sm:col-span-2"><Save className="h-4 w-4" /> Save effective settings</button>
    </form>
    <div className="overflow-hidden rounded-md border border-line"><div className="border-b border-line bg-paper px-3 py-2 text-xs font-semibold">Settings history</div>{settings.map((item) => <div key={item.id} className="grid grid-cols-3 gap-2 border-b border-line px-3 py-2 text-xs last:border-0"><span>{item.effective_from}</span><span>{formatPesos(item.membership_fee_centavos)} fee</span><span>{formatPesos(item.capital_share_target_centavos)} capital</span></div>)}</div>
  </div>;
}
