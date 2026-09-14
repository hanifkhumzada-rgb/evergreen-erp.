"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Search, X, ChevronDown } from "lucide-react";

// Search Customer by ID, name or phone — debounced client-side filter over
// the customers list the server already fetched (this business rarely has
// more than a few hundred customers, so no round trip is needed).
export default function CustomerPicker({ customers, value, onChange, error }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const rootRef = useRef(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim().toLowerCase()), 150);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    const close = (e) => { if (!rootRef.current?.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const selected = useMemo(() => customers.find((c) => c.id === value), [customers, value]);

  const filtered = useMemo(() => {
    if (!debounced) return customers.slice(0, 40);
    return customers.filter((c) =>
      [c.code, c.name, c.mobile, c.zone_name].filter(Boolean).join(" ").toLowerCase().includes(debounced)
    ).slice(0, 40);
  }, [customers, debounced]);

  return (
    <div ref={rootRef} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)}
        className={`in flex items-center justify-between text-left ${error ? "border-coral" : ""}`}>
        <span className={selected ? "" : "text-slate"}>
          {selected ? `${selected.name} — ${selected.code || selected.mobile}` : "Search by ID, name or phone…"}
        </span>
        <ChevronDown size={14} className="flex-shrink-0 text-slate" />
      </button>
      {open && (
        <div className="absolute z-30 mt-1 w-full max-h-72 overflow-y-auto rounded-xl border border-line bg-card shadow-xl">
          <div className="sticky top-0 flex items-center gap-1.5 border-b border-line bg-card p-2">
            <Search size={13} className="text-slate flex-shrink-0" />
            <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder="Type ID, name or phone…" className="w-full text-xs outline-none bg-transparent" />
            {query && <button type="button" onClick={() => setQuery("")}><X size={13} className="text-slate" /></button>}
          </div>
          {filtered.length === 0 && <div className="p-3 text-xs text-slate text-center">No matching customer.</div>}
          {filtered.map((c) => (
            <button key={c.id} type="button"
              onClick={() => { onChange(c.id); setOpen(false); setQuery(""); }}
              className={`flex w-full flex-col items-start px-3 py-2 text-left text-xs hover:bg-foam ${c.id === value ? "bg-aquaSoft" : ""}`}>
              <span className="font-semibold">{c.name}</span>
              <span className="text-slate">{c.code || "—"} · {c.mobile || "no phone"} {c.zone_name ? `· ${c.zone_name}` : ""}{!c.is_active ? " · Inactive" : ""}</span>
            </button>
          ))}
        </div>
      )}
      {error && <p className="text-coral text-[11px] mt-1">{error}</p>}
    </div>
  );
}
