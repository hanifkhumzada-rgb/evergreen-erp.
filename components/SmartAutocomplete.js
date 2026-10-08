"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { rankSmartOptions } from "@/lib/smartMatch";

export default function SmartAutocomplete({ options = [], value, onChange, placeholder = "Search…", labelKey = "name", sublabel, searchKeys, error, disabled = false }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const rootRef = useRef(null);
  const selected = options.find((option) => String(option.value ?? option.id) === String(value));
  const filtered = useMemo(() => rankSmartOptions(options, query, searchKeys || [labelKey, "label", "name", "code", "mobile"], 15), [options, query, searchKeys, labelKey]);

  useEffect(() => {
    const close = (event) => { if (!rootRef.current?.contains(event.target)) setOpen(false); };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);
  useEffect(() => setActive(0), [query]);

  const choose = (option) => {
    onChange?.(String(option.value ?? option.id), option);
    setQuery(""); setOpen(false);
  };
  const onKeyDown = (event) => {
    if (event.key === "ArrowDown") { event.preventDefault(); setActive((i) => Math.min(i + 1, filtered.length - 1)); }
    if (event.key === "ArrowUp") { event.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
    if (event.key === "Enter" && filtered[active]) { event.preventDefault(); choose(filtered[active]); }
    if (event.key === "Escape") setOpen(false);
  };

  return <div ref={rootRef} className="relative">
    <button type="button" disabled={disabled} onClick={() => setOpen((state) => !state)} className={`in flex items-center justify-between gap-2 text-left disabled:opacity-60 ${error ? "!border-coral" : ""}`}>
      <span className={`truncate ${selected ? "" : "text-slate"}`}>{selected ? selected[labelKey] || selected.label : placeholder}</span><ChevronDown size={14} className="shrink-0 text-slate" />
    </button>
    {open && <div className="absolute z-40 mt-1 w-full min-w-[240px] overflow-hidden rounded-xl border border-line bg-card shadow-xl">
      <div className="flex items-center gap-2 border-b border-line p-2"><Search size={14} className="text-slate" /><input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={onKeyDown} placeholder={placeholder} className="min-w-0 flex-1 bg-transparent text-xs outline-none" />{query && <button type="button" onClick={() => setQuery("")}><X size={13} /></button>}</div>
      <div className="max-h-64 overflow-y-auto p-1.5">
        {!filtered.length && <p className="p-3 text-center text-xs text-slate">No matching record.</p>}
        {filtered.map((option, index) => { const optionValue = String(option.value ?? option.id); return <button key={optionValue} type="button" onMouseEnter={() => setActive(index)} onClick={() => choose(option)} className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs ${index === active ? "bg-aquaSoft" : "hover:bg-foam"}`}><span className="min-w-0 flex-1"><strong className="block truncate">{option[labelKey] || option.label}</strong>{sublabel && <span className="block truncate text-[10px] text-slate">{sublabel(option)}</span>}</span>{optionValue === String(value) && <Check size={13} className="text-aqua" />}</button>; })}
      </div>
    </div>}
    {error && <p className="mt-1 text-[11px] text-coral">{error}</p>}
  </div>;
}
