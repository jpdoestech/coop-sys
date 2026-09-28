import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check, RotateCcw, SlidersHorizontal, X } from "lucide-react";

type FilterMenuProps = {
  activeCount: number;
  children: ReactNode;
  onClear: () => void;
  label?: string;
};

export function FilterMenu({ activeCount, children, onClear, label = "Filters" }: FilterMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function close(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  return (
    <div className="relative" ref={rootRef}>
      <button type="button" onClick={() => setOpen((value) => !value)} className={`focus-ring inline-flex h-9 items-center gap-2 whitespace-nowrap rounded-md border px-3 text-xs font-semibold transition ${open || activeCount ? "border-moss/30 bg-emerald-50 text-moss" : "border-line bg-white text-ink/65 hover:bg-paper"}`} aria-expanded={open}>
        <SlidersHorizontal className="h-4 w-4" />
        {label}
        {activeCount ? <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-moss px-1 text-[10px] text-white">{activeCount}</span> : null}
      </button>
      {open ? (
        <div className="absolute right-0 top-12 z-30 w-[min(340px,calc(100vw-2rem))] rounded-md border border-line bg-white p-4 shadow-panel">
          <div className="mb-4 flex items-center justify-between">
            <div><p className="text-sm font-semibold text-ink">Filter records</p><p className="mt-0.5 text-xs text-ink/50">Selections update the table instantly.</p></div>
            <button type="button" className="icon-button h-8 w-8" onClick={() => setOpen(false)} title="Close filters" aria-label="Close filters"><X className="h-4 w-4" /></button>
          </div>
          <div className="space-y-3">{children}</div>
          <div className="mt-4 flex items-center justify-between border-t border-line pt-3">
            <button type="button" onClick={onClear} disabled={!activeCount} className="focus-ring inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-semibold text-ink/55 hover:bg-paper disabled:opacity-35"><RotateCcw className="h-3.5 w-3.5" /> Clear all</button>
            <button type="button" onClick={() => setOpen(false)} className="focus-ring inline-flex items-center gap-1.5 rounded-md bg-ink px-3 py-1.5 text-xs font-semibold text-white hover:bg-ink/90"><Check className="h-3.5 w-3.5" /> Done</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
