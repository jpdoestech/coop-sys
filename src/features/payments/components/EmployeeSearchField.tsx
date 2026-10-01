import { Check, Search, UserRoundSearch } from "lucide-react";
import { useMemo, useState } from "react";
import type { Employee } from "../../../types/employee";
import { employeeFullName } from "../../../services/imports/identityMatching";

type Props = {
  employees: Employee[];
  value: string;
  onChange: (employeeId: string) => void;
  label: string;
  placeholder?: string;
  emptyMessage?: string;
  required?: boolean;
};

export function EmployeeSearchField({ employees, value, onChange, label, placeholder = "Type employee ID or name", emptyMessage = "No matching employee in your access scope.", required }: Props) {
  const selected = employees.find((employee) => employee.id === value) ?? null;
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const term = query.trim().toLowerCase();
  const matches = useMemo(() => employees.filter((employee) => !term || [employee.employee_number, employee.first_name, employee.middle_name, employee.last_name, employee.suffix].filter(Boolean).join(" ").toLowerCase().includes(term)).slice(0, 8), [employees, term]);

  function choose(employee: Employee) {
    onChange(employee.id);
    setQuery("");
    setOpen(false);
  }

  return <label className="field-label relative" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false); }}>
    {label}
    <div className="relative mt-1">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/35" />
      <input
        className="control w-full pl-9 pr-9"
        role="combobox"
        aria-expanded={open}
        aria-controls="employee-search-results"
        aria-autocomplete="list"
        required={required && !selected}
        value={selected && !query ? `${selected.employee_number} - ${employeeFullName(selected)}` : query}
        placeholder={placeholder}
        onFocus={() => setOpen(true)}
        onChange={(event) => { setQuery(event.target.value); onChange(""); setOpen(true); }}
        onKeyDown={(event) => { if (event.key === "Escape") setOpen(false); if (event.key === "Enter" && open && matches.length) { event.preventDefault(); choose(matches[0]); } }}
      />
      {selected && !query ? <Check className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-600" /> : null}
    </div>
    {open ? <div id="employee-search-results" role="listbox" className="absolute left-0 right-0 top-full z-30 mt-1 max-h-64 overflow-y-auto rounded-md border border-line bg-white p-1 text-xs shadow-xl">
      {matches.map((employee) => <button key={employee.id} type="button" role="option" aria-selected={employee.id === value} onMouseDown={(event) => event.preventDefault()} onClick={() => choose(employee)} className="flex w-full items-center gap-3 rounded px-3 py-2 text-left hover:bg-[#f1f7f3]"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-[#e4efe9] text-moss"><UserRoundSearch className="h-3.5 w-3.5" /></span><span className="min-w-0 flex-1"><span className="block truncate font-semibold text-ink">{employeeFullName(employee)}</span><span className="block font-mono text-[10px] text-ink/45">{employee.employee_number}</span></span>{employee.id === value ? <Check className="h-4 w-4 text-emerald-600" /> : null}</button>)}
      {!matches.length ? <p className="px-3 py-5 text-center text-xs text-ink/45">{emptyMessage}</p> : null}
    </div> : null}
  </label>;
}
