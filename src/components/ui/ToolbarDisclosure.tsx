import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { DropdownSurface } from "./DropdownSurface";

export function ToolbarDisclosure({ label, icon: Icon, count = 0, children, disabled = false }: { label: string; icon: LucideIcon; count?: number; children: ReactNode; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const insideEvents = useRef(new WeakSet<Event>());
  useEffect(() => {
    if (!open) return;
    // Searchable selects render their menus in a portal, but React still captures their events here.
    const outside = (event: PointerEvent) => { if (!ref.current?.contains(event.target as Node) && !insideEvents.current.has(event)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { event.stopPropagation(); setOpen(false); button.current?.focus(); } };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, [open]);
  return <div ref={ref} className="relative shrink-0" onPointerDownCapture={(event) => insideEvents.current.add(event.nativeEvent)}>
    <button ref={button} type="button" className={`icon-button relative ${count || open ? "bg-moss/10 text-moss" : ""}`} title={label} aria-label={label} aria-expanded={open} aria-controls={open ? id : undefined} disabled={disabled} onClick={() => setOpen((value) => !value)}>
      <Icon className="h-4 w-4" />
      {count ? <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-moss px-0.5 text-[9px] font-bold text-white">{count}<span className="sr-only"> active filters</span></span> : null}
    </button>
    {open ? <DropdownSurface id={id} role="group" preferredWidth={440}><div className="space-y-2 p-2"><p className="text-xs font-semibold text-ink">{label}</p>{children}</div></DropdownSurface> : null}
  </div>;
}
