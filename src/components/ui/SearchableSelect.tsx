import { Children, isValidElement, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode, type SelectHTMLAttributes } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Plus, Search, TextCursorInput } from "lucide-react";
import { DropdownSurface } from "./DropdownSurface";

type Props = SelectHTMLAttributes<HTMLSelectElement> & { onCustomValue?: (value: string) => void; onCreate?: (value: string) => void; createLabel?: string; attentionValue?: string };
type Option = { value: string; label: string; disabled: boolean };
function text(node: ReactNode): string { return Children.toArray(node).map((item) => isValidElement<{ children?: ReactNode }>(item) ? text(item.props.children) : String(item)).join(""); }
function optionsFrom(children: ReactNode, parentDisabled = false): Option[] {
  return Children.toArray(children).flatMap((child) => {
    if (!isValidElement<{ value?: string | number; disabled?: boolean; children?: ReactNode }>(child)) return [];
    if (child.type === "option") return [{ value: String(child.props.value ?? text(child.props.children)), label: text(child.props.children), disabled: parentDisabled || Boolean(child.props.disabled) }];
    return optionsFrom(child.props.children, parentDisabled || Boolean(child.props.disabled));
  });
}

export function SearchableSelect({ children, className = "compact-control", onCustomValue, onCreate, createLabel = "Add option", attentionValue, ...props }: Props) {
  const native = useRef<HTMLSelectElement>(null), button = useRef<HTMLButtonElement>(null), menu = useRef<HTMLDivElement>(null), searchInput = useRef<HTMLInputElement>(null);
  const id = useId(); const [open, setOpen] = useState(false), [search, setSearch] = useState(""), [highlight, setHighlight] = useState(0), [label, setLabel] = useState("Select option"), [invalid, setInvalid] = useState(false);
  const options = optionsFrom(children);
  const ariaLabel = props["aria-label"];
  const selectedValue = String(props.value ?? native.current?.value ?? props.defaultValue ?? options[0]?.value ?? "");
  const selected = options.find((option) => option.value === selectedValue);
  const filtered = options.filter((option) => option.label.toLowerCase().includes(search.trim().toLowerCase()));
  const enabled = filtered.filter((option) => !option.disabled);
  useLayoutEffect(() => {
    const parentLabel = native.current?.closest("label");
    const surrounding = parentLabel ? [...parentLabel.childNodes].filter((node) => node.nodeType === Node.TEXT_NODE).map((node) => node.textContent?.trim()).filter(Boolean).join(" ") : "";
    setLabel(ariaLabel || surrounding || "Select option");
  }, [ariaLabel]);
  useEffect(() => {
    if (!open) return;
    searchInput.current?.focus();
    const outside = (event: PointerEvent) => { if (!button.current?.contains(event.target as Node) && !menu.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  const close = () => { setOpen(false); button.current?.focus(); };
  function choose(value: string) {
    const select = native.current;
    if (!select || props.disabled) return;
    select.value = value;
    select.dispatchEvent(new Event("change", { bubbles: true }));
    setInvalid(false); close();
  }
  function show() { if (props.disabled) return; setSearch(""); setHighlight(0); setOpen(true); }
  return <>
    <select {...props} ref={native} className="sr-only" aria-hidden="true" tabIndex={-1} onInvalid={(event) => { event.preventDefault(); setInvalid(true); show(); props.onInvalid?.(event); }}>{children}</select>
    <button ref={button} type="button" role="combobox" aria-label={label} aria-controls={`${id}-list`} aria-expanded={open} aria-haspopup="listbox" aria-required={props.required} aria-invalid={invalid || undefined} disabled={props.disabled} className={`${className} inline-flex min-w-0 items-center justify-between gap-2 overflow-hidden text-left ${invalid ? "border-red-500" : attentionValue || (onCustomValue && selectedValue && !selected) ? "border-amber-400 bg-amber-50" : ""}`} onClick={(event) => { event.preventDefault(); if (open) close(); else show(); }} onKeyDown={(event) => { if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) { event.preventDefault(); show(); } }}>
      <span className="min-w-0 truncate" title={attentionValue || selected?.label || selectedValue || "Select option"}>{attentionValue || selected?.label || selectedValue || "Select option"}</span><ChevronDown className="h-3.5 w-3.5 shrink-0 text-ink/45" />
    </button>
    {open && !props.disabled ? createPortal(<DropdownSurface anchorRef={button} preferredWidth={Math.max(button.current?.getBoundingClientRect().width || 240, 240)}><div ref={menu} onKeyDown={(event) => {
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); close(); }
      if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); setHighlight((current) => enabled.length ? (current + (event.key === "ArrowDown" ? 1 : -1) + enabled.length) % enabled.length : 0); }
      if (event.key === "Enter") { event.preventDefault(); if (enabled[highlight]) choose(enabled[highlight].value); else if (onCustomValue && search.trim()) { onCustomValue(search.trim()); close(); } }
      if (event.key === "Tab") close();
    }}><div className="sticky top-0 z-10 bg-white pb-1"><label className="relative block"><Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink/40" /><input ref={searchInput} role="searchbox" aria-label={`Search ${label}`} aria-controls={`${id}-list`} aria-activedescendant={enabled[highlight] ? `${id}-option-${options.indexOf(enabled[highlight])}` : undefined} className="compact-control w-full pl-8" placeholder="Search..." value={search} onChange={(event) => { setSearch(event.target.value); setHighlight(0); }} /></label></div>
      <div id={`${id}-list`} role="listbox" aria-label={label}>{filtered.map((option) => <button key={option.value} id={`${id}-option-${options.indexOf(option)}`} role="option" aria-selected={selectedValue === option.value} aria-disabled={option.disabled} disabled={option.disabled} type="button" className={`flex w-full items-center justify-between gap-2 rounded px-2.5 py-2 text-left text-xs disabled:opacity-40 ${enabled[highlight] === option ? "bg-paper" : "hover:bg-paper"}`} onMouseEnter={() => setHighlight(enabled.indexOf(option))} onClick={() => choose(option.value)}><span className="min-w-0 break-words">{option.label}</span>{selectedValue === option.value ? <Check className="h-3.5 w-3.5 shrink-0 text-moss" /> : null}</button>)}{!filtered.length ? <p className="p-3 text-xs text-ink/45">No matches.</p> : null}</div>
      {onCustomValue && search.trim() && !options.some((option) => option.label.toLowerCase() === search.trim().toLowerCase()) ? <button type="button" className="flex w-full items-center gap-2 border-t border-line px-2.5 py-2 text-left text-xs text-moss" onClick={() => { onCustomValue(search.trim()); close(); }}><TextCursorInput className="h-3.5 w-3.5 shrink-0" /><span className="break-words">Use "{search.trim()}"</span></button> : null}
      {onCreate ? <button type="button" className="flex w-full items-center gap-2 border-t border-line px-2.5 py-2 text-left text-xs font-semibold text-moss" onClick={() => { onCreate(search.trim()); close(); }}><Plus className="h-3.5 w-3.5" />{createLabel}</button> : null}
    </div></DropdownSurface>, document.body) : null}
  </>;
}
