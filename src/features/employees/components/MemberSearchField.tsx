import { Check, Search, UserRound } from "lucide-react";
import { useMemo, useState } from "react";
import type { Member } from "../../../types/member";

type Props = { members: Member[]; value: string; onChange: (memberId: string) => void };

export function MemberSearchField({ members, value, onChange }: Props) {
  const selected = members.find((member) => member.id === value) ?? null;
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const term = query.trim().toLowerCase();
  const matches = useMemo(() => members.filter((member) => !term || [member.membership_number, member.first_name, member.middle_name, member.last_name, member.suffix].filter(Boolean).join(" ").toLowerCase().includes(term)).slice(0, 10), [members, term]);
  const label = (member: Member) => `${member.membership_number} - ${member.last_name}, ${member.first_name}`;

  return <div className="relative" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false); }}><div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/35" /><input className="control w-full pl-9 pr-9" role="combobox" aria-label="Search existing member ID or name" aria-expanded={open} value={selected && !query ? label(selected) : query} placeholder="Type member ID or name" onFocus={() => setOpen(true)} onChange={(event) => { setQuery(event.target.value); onChange(""); setOpen(true); }} onKeyDown={(event) => { if (event.key === "Escape") setOpen(false); if (event.key === "Enter" && open && matches.length) { event.preventDefault(); onChange(matches[0].id); setQuery(""); setOpen(false); } }} />{selected && !query ? <Check className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-600" /> : null}</div>{open ? <div role="listbox" className="absolute left-0 right-0 z-40 mt-1 max-h-64 overflow-auto rounded-md border border-line bg-white p-1 shadow-xl">{matches.map((member) => <button key={member.id} type="button" role="option" aria-selected={member.id === value} className="flex w-full items-center gap-3 rounded px-3 py-2 text-left hover:bg-[#f1f7f3]" onMouseDown={(event) => event.preventDefault()} onClick={() => { onChange(member.id); setQuery(""); setOpen(false); }}><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-[#e4efe9] text-moss"><UserRound className="h-3.5 w-3.5" /></span><span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold">{member.last_name}, {member.first_name}</span><span className="block font-mono text-[10px] text-ink/45">{member.membership_number}</span></span>{member.id === value ? <Check className="h-4 w-4 text-emerald-600" /> : null}</button>)}{!matches.length ? <p className="px-3 py-5 text-center text-xs text-ink/45">No member found.</p> : null}</div> : null}</div>;
}
