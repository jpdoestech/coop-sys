import { CalendarSearch, Check, X } from "lucide-react";
import { useMemo, useState } from "react";
import type { PaymentBatch } from "../../../types/payment";
import type { PaymentPeriodFilter } from "../../../services/repositories/PaymentRepository";
import { detailedPeriod } from "../paymentFilters";

type Props = {
  batches: PaymentBatch[];
  value: PaymentPeriodFilter | null;
  onChange: (value: PaymentPeriodFilter | null) => void;
};

export function PaymentPeriodSearchField({ batches, value, onChange }: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const options = useMemo(() => {
    const grouped = new Map<string, PaymentPeriodFilter & { count: number }>();
    batches.filter((batch) => !batch.deleted_at).forEach((batch) => {
      const option: PaymentPeriodFilter = batch.cutoff_from && batch.cutoff_to
        ? { kind: "cutoff", cutoffFrom: batch.cutoff_from, cutoffTo: batch.cutoff_to, label: detailedPeriod(batch.cutoff_from, batch.cutoff_to, batch.payment_date) }
        : { kind: "date", paymentDate: batch.payment_date, label: detailedPeriod(null, null, batch.payment_date) };
      const key = option.kind === "cutoff" ? `cutoff:${option.cutoffFrom}:${option.cutoffTo}` : `date:${option.paymentDate}`;
      const existing = grouped.get(key);
      grouped.set(key, { ...option, count: (existing?.count ?? 0) + 1 });
    });
    const term = query.trim().toLowerCase();
    return [...grouped.values()]
      .filter((option) => !term || option.label.toLowerCase().includes(term))
      .sort((a, b) => b.label.localeCompare(a.label))
      .slice(0, 12);
  }, [batches, query]);

  return (
    <div className="relative w-full sm:w-64" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false); }}>
      <CalendarSearch className="pointer-events-none absolute left-3 top-1/2 z-10 h-3.5 w-3.5 -translate-y-1/2 text-ink/35" />
      <input className="compact-control w-full pl-8 pr-8" role="combobox" aria-expanded={open} value={value && !query ? value.label : query} placeholder="Search cut-off or date" onFocus={() => setOpen(true)} onChange={(event) => { setQuery(event.target.value); onChange(null); setOpen(true); }} />
      {value ? <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-ink/40 hover:text-ink" aria-label="Clear period filter" onClick={() => { onChange(null); setQuery(""); }}><X className="h-3.5 w-3.5" /></button> : null}
      {open ? <div className="absolute left-0 right-0 z-40 mt-1 max-h-72 overflow-auto rounded-md border border-line bg-white p-1 shadow-xl">
        {options.map((option) => {
          const key = option.kind === "cutoff" ? `cutoff:${option.cutoffFrom}:${option.cutoffTo}` : `date:${option.paymentDate}`;
          const selected = value?.kind === option.kind && (option.kind === "cutoff" ? value.kind === "cutoff" && value.cutoffFrom === option.cutoffFrom && value.cutoffTo === option.cutoffTo : value.kind === "date" && value.paymentDate === option.paymentDate);
          return <button key={key} type="button" className="flex w-full items-center gap-2 rounded px-2.5 py-2 text-left hover:bg-[#f1f7f3]" onMouseDown={(event) => event.preventDefault()} onClick={() => { const { count: _count, ...selection } = option; void _count; onChange(selection); setQuery(""); setOpen(false); }}><CalendarSearch className="h-3.5 w-3.5 shrink-0 text-moss" /><span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold">{option.label}</span><span className="block text-[10px] text-ink/45">{option.kind === "cutoff" ? "Payroll cut-off" : "Payment date"} · {option.count} upload{option.count === 1 ? "" : "s"}</span></span>{selected ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : null}</button>;
        })}
        {!options.length ? <p className="px-3 py-4 text-center text-xs text-ink/45">No uploaded cut-off or payment date found.</p> : null}
      </div> : null}
    </div>
  );
}
