import { Building2, Check, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import type { OrganizationBranch, OrganizationClient } from "../../../types/organization";

export type PlacementFilter = { kind: "branch" | "client"; id: string; label: string } | null;
type Props = { branches: OrganizationBranch[]; clients: OrganizationClient[]; value: PlacementFilter; onChange: (value: PlacementFilter) => void };

export function PlacementSearchField({ branches, clients, value, onChange }: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const options = useMemo(() => {
    const term = query.trim().toLowerCase();
    return [
      ...branches.map((branch) => ({ kind: "branch" as const, id: branch.id, label: branch.label, detail: "Branch" })),
      ...clients.map((client) => ({ kind: "client" as const, id: client.id, label: client.label, detail: branches.find((branch) => branch.id === client.branchId)?.label ?? "Client" })),
    ].filter((item) => !term || `${item.label} ${item.detail}`.toLowerCase().includes(term)).slice(0, 10);
  }, [branches, clients, query]);

  return <div className="relative w-full sm:w-64" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false); }}>
    <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-3.5 w-3.5 -translate-y-1/2 text-ink/35" />
    <input className="compact-control w-full pl-8 pr-8" role="combobox" aria-expanded={open} value={value && !query ? value.label : query} placeholder="Search branch or client" onFocus={() => setOpen(true)} onChange={(event) => { setQuery(event.target.value); onChange(null); setOpen(true); }} />
    {value ? <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-ink/40 hover:text-ink" aria-label="Clear placement filter" onClick={() => { onChange(null); setQuery(""); }}><X className="h-3.5 w-3.5" /></button> : null}
    {open ? <div className="absolute left-0 right-0 z-40 mt-1 max-h-72 overflow-auto rounded-md border border-line bg-white p-1 shadow-xl">{options.map((item) => <button key={`${item.kind}-${item.id}`} type="button" className="flex w-full items-center gap-2 rounded px-2.5 py-2 text-left hover:bg-[#f1f7f3]" onMouseDown={(event) => event.preventDefault()} onClick={() => { onChange({ kind: item.kind, id: item.id, label: item.label }); setQuery(""); setOpen(false); }}><Building2 className="h-3.5 w-3.5 shrink-0 text-moss" /><span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold">{item.label}</span><span className="block truncate text-[10px] text-ink/45">{item.detail}</span></span>{value?.id === item.id && value.kind === item.kind ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : null}</button>)}{!options.length ? <p className="px-3 py-4 text-center text-xs text-ink/45">No branch or client found.</p> : null}</div> : null}
  </div>;
}
