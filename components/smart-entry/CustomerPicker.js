"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Check, Loader2, Search, X, ChevronDown } from "lucide-react";
import { searchCustomerSuggestions } from "@/app/actions";
import { rankSmartOptions } from "@/lib/smartMatch";

const cache = new Map();

export default function CustomerPicker({ customers = [], value, onChange, onSelect, error, placeholder = "Search ID, name, phone, building or flat…" }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [remoteRows, setRemoteRows] = useState([]);
  const [active, setActive] = useState(0);
  const [isPending, startTransition] = useTransition();
  const rootRef = useRef(null);
  const selected = useMemo(() => [...customers, ...remoteRows].find((c) => c.id === value), [customers, remoteRows, value]);

  useEffect(() => {
    const close = (event) => { if (!rootRef.current?.contains(event.target)) setOpen(false); };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);

  useEffect(() => {
    const term = query.trim();
    setActive(0);
    if (!term) { setRemoteRows([]); return undefined; }
    const timer = setTimeout(() => {
      const key = term.toLowerCase();
      if (cache.has(key)) { setRemoteRows(cache.get(key)); return; }
      startTransition(async () => {
        const result = await searchCustomerSuggestions(term, 12);
        if (!result?.error) { cache.set(key, result.rows || []); setRemoteRows(result.rows || []); }
      });
    }, 180);
    return () => clearTimeout(timer);
  }, [query]);

  const filtered = useMemo(() => {
    if (!query.trim()) return customers.slice(0, 12);
    const merged = new Map([...remoteRows, ...customers].map((row) => [row.id, row]));
    return rankSmartOptions([...merged.values()], query, ["code", "mobile", "name", "building", "address", "zone_name"], 12);
  }, [customers, remoteRows, query]);

  const choose = (customer) => {
    onChange(customer.id);
    onSelect?.(customer);
    setOpen(false); setQuery("");
  };
  const onKeyDown = (event) => {
    if (event.key === "ArrowDown") { event.preventDefault(); setActive((index) => Math.min(index + 1, filtered.length - 1)); }
    if (event.key === "ArrowUp") { event.preventDefault(); setActive((index) => Math.max(index - 1, 0)); }
    if (event.key === "Enter" && filtered[active]) { event.preventDefault(); choose(filtered[active]); }
    if (event.key === "Escape") setOpen(false);
  };

  return <div ref={rootRef} className="relative">
    <button type="button" onClick={() => setOpen((state) => !state)} className={`in flex items-center justify-between gap-2 text-left ${error ? "!border-coral" : ""}`}>
      <span className={`truncate ${selected ? "" : "text-slate"}`}>{selected ? `${selected.code || "—"} | ${selected.name}` : placeholder}</span><ChevronDown size={14} className="shrink-0 text-slate" />
    </button>
    {open && <div className="absolute z-50 mt-1 w-full min-w-[300px] overflow-hidden rounded-xl border border-line bg-card shadow-xl">
      <div className="flex items-center gap-2 border-b border-line p-2"><Search size={14} className="text-slate" /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={onKeyDown} placeholder={placeholder} className="min-w-0 flex-1 bg-transparent text-xs outline-none" />{isPending ? <Loader2 size={13} className="animate-spin text-aqua" /> : query && <button type="button" onClick={() => setQuery("")}><X size={13} /></button>}</div>
      <div className="max-h-72 overflow-y-auto p-1.5">
        {!isPending && !filtered.length && <p className="p-3 text-center text-xs text-slate">No matching customer. Check spelling or phone number.</p>}
        {filtered.map((customer, index) => <button key={customer.id} type="button" onMouseEnter={() => setActive(index)} onClick={() => choose(customer)} className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs ${index === active ? "bg-aquaSoft" : "hover:bg-foam"}`}>
          <span className="min-w-0 flex-1"><strong className="block truncate">{customer.code || "—"} | {customer.name} | {customer.building || customer.address || "No building"} | {customer.zone_name || customer.zoneName || "No zone"}</strong><span className="block truncate text-[10px] text-slate">{customer.mobile || "No phone"}{customer.payment_frequency ? ` · ${customer.payment_frequency}` : ""}{customer.is_active === false ? " · Inactive" : ""}</span></span>{customer.id === value && <Check size={13} className="shrink-0 text-aqua" />}
        </button>)}
      </div>
      <div className="border-t border-line bg-foam px-3 py-1.5 text-[10px] text-slate">↑↓ navigate · Enter select · Esc close</div>
    </div>}
    {error && <p className="mt-1 text-[11px] text-coral">{error}</p>}
  </div>;
}
