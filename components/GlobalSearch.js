"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Search, X, User, Receipt } from "lucide-react";
import { globalSearch } from "@/app/actions";

function ResultsDropdown({ query, results, isPending, onSelect }) {
  const hasResults = (results?.customers?.length || 0) + (results?.invoices?.length || 0) > 0;
  return (
    <div className="absolute top-full mt-2 left-0 right-0 sm:left-auto sm:right-0 sm:w-80 max-h-80 overflow-y-auto bg-card border border-line rounded-xl shadow-lg z-[70]">
      {isPending && <div className="p-3 text-xs text-slate">Searching…</div>}
      {!isPending && !hasResults && <div className="p-3 text-xs text-slate">No matches for &quot;{query}&quot;.</div>}
      {!isPending && results?.customers?.length > 0 && (
        <div className="py-1.5">
          <div className="px-3 py-1 text-[10px] font-bold tracking-wider text-slate">CUSTOMERS</div>
          {results.customers.map((c) => (
            <Link key={c.id} href={`/customers/${c.id}`} onClick={onSelect}
              className="flex items-center gap-2 px-3 py-2 hover:bg-foam text-sm">
              <User size={14} className="text-aqua flex-shrink-0" />
              <span className="flex-1 min-w-0 truncate">{c.name}</span>
              <span className="text-xs text-slate flex-shrink-0">{c.mobile}</span>
            </Link>
          ))}
        </div>
      )}
      {!isPending && results?.invoices?.length > 0 && (
        <div className="py-1.5 border-t border-line">
          <div className="px-3 py-1 text-[10px] font-bold tracking-wider text-slate">SALES</div>
          {results.invoices.map((s) => (
            <Link key={s.id} href={`/sales/${s.id}`} onClick={onSelect}
              className="flex items-center gap-2 px-3 py-2 hover:bg-foam text-sm">
              <Receipt size={14} className="text-aqua flex-shrink-0" />
              <span className="flex-1 min-w-0 truncate">{s.invoice_no}</span>
              <span className="text-xs text-slate flex-shrink-0 truncate max-w-[8rem]">{s.customers?.name}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default function GlobalSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState(null);
  const [open, setOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const timeoutRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    function onClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const handleChange = (value) => {
    setQuery(value);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (value.trim().length < 2) {
      setResults(null);
      setOpen(false);
      return;
    }
    timeoutRef.current = setTimeout(() => {
      startTransition(async () => {
        const res = await globalSearch(value.trim());
        setResults(res);
        setOpen(true);
      });
    }, 300);
  };

  const closeAll = () => { setOpen(false); setMobileOpen(false); };

  return (
    <div ref={containerRef} className="relative">
      <div className="hidden md:flex items-center gap-2 px-3 py-1.75 rounded-lg border border-line bg-foam w-52 lg:w-72">
        <Search size={14} className="text-slate flex-shrink-0" />
        <input
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => results && setOpen(true)}
          placeholder="Search customers, invoices…"
          className="bg-transparent outline-none text-sm flex-1 min-w-0"
        />
      </div>

      <button onClick={() => setMobileOpen((v) => !v)} className="md:hidden p-1.5 rounded-lg hover:bg-foam" aria-label="Search">
        <Search size={18} className="text-slate" />
      </button>

      {mobileOpen && (
        <div className="fixed inset-x-0 top-0 z-[70] bg-card p-3 border-b border-line flex items-center gap-2 md:hidden">
          <Search size={16} className="text-slate flex-shrink-0" />
          <input
            autoFocus
            value={query}
            onChange={(e) => handleChange(e.target.value)}
            placeholder="Search customers, invoices…"
            className="bg-transparent outline-none text-sm flex-1 min-w-0"
          />
          <button onClick={closeAll} aria-label="Close search"><X size={18} /></button>
          {open && query.trim().length >= 2 && (
            <div className="absolute top-full inset-x-3 mt-0">
              <ResultsDropdown query={query} results={results} isPending={isPending} onSelect={closeAll} />
            </div>
          )}
        </div>
      )}

      {!mobileOpen && open && query.trim().length >= 2 && (
        <ResultsDropdown query={query} results={results} isPending={isPending} onSelect={closeAll} />
      )}
    </div>
  );
}
