import type { ReactNode } from "react";

export function FilterField({ label, children, fullWidth = false }: { label: string; children: ReactNode; fullWidth?: boolean }) {
  return <div role="group" aria-label={label} className={`filter-field min-w-0 ${fullWidth ? "col-span-full" : ""}`}>
    <span className="field-label mb-1">{label}</span>
    {children}
  </div>;
}
