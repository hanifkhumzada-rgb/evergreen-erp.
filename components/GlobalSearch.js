"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Search, X, User, Receipt, Truck, Wallet, UserCog, Car } from "lucide-react";
import { globalSearch } from "@/app/actions";

function ResultSection({ title, icon: Icon, items, onSelect, render }) {
  if (!items?.length) return null;
  return (
    <div className="py-1.5 border-t border-line first:border-t-0">
      <div className="px-3 py-1 text-[10px] font-bold tracking-wider text-slate">{title}</div>
      {items.map((item) => {
        const { href, label, sub } = render(item);
        return (
          <Link key={item.id} href={href} onClick={onSelect} className="flex items-center gap-2 px-3 py-2 hover:bg-foam text-sm">
            <Icon size={14} className="text-aqua flex-shrink-0" />
            <span className="flex-1 min-w-0 truncate">{label}</span>
            {sub && <span className="text-xs text-slate flex-shrink-0 truncate max-w-[8rem]">{sub}</span>}
          </Link>
        );
      })}
    </div>
  );
}

function ResultsDropdown({ query, results, isPending, onSelect }) {
  const hasResults = ["customers", "invoices", "deliveries", "payments", "employees", "vehicles"]
    .some((k) => (results?.[k]?.length || 0) > 0);
  return (
    <div className="absolute top-full mt-2 left-0 right-0 sm:left-auto sm:right-0 sm:w-80 max-h-96 overflow-y-auto bg-card border border-line rounded-xl shadow-lg z-[70]">
      {isPending && <div className="p-3 text-xs text-slate">Searching…</div>}
      {!isPending && !hasResults && <div className="p-3 text-xs text-slate">No matches for &quot;{query}&quot;.</div>}
      {!isPending && (
        <>
          <ResultSection title="CUSTOMERS" icon={User} items={results?.customers} onSelect={onSelect}
            render={(c) => ({ href: `/customers/${c.id}`, label: c.name, sub: c.code || c.mobile })} />
          <ResultSection title="SALES" icon={Receipt} items={results?.invoices} onSelect={onSelect}
            render={(s) => ({ href: `/sales/${s.id}`, label: s.invoice_no, sub: s.customers?.name })} />
          <ResultSection title="DELIVERIES" icon={Truck} items={results?.deliveries} onSelect={onSelect}
            render={(d) => ({ href: "/deliveries", label: d.delivery_no, sub: d.customers?.name })} />
          <ResultSection title="PAYMENTS" icon={Wallet} items={results?.payments} onSelect={onSelect}
            render={(p) => ({ href: "/payments", label: p.receipt_no, sub: p.customers?.name })} />
          <ResultSection title="EMPLOYEES" icon={UserCog} items={results?.employees} onSelect={onSelect}
            render={(e) => ({ href: "/employees", label: e.full_name })} />
          <ResultSection title="VEHICLES" icon={Car} items={results?.vehicles} onSelect={onSelect}
            render={(v) => ({ href: "/fleet", label: v.registration_no })} />
        </>
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
          placeholder="Search customers, sales, deliveries…"
          className="bg-transparent outline-none text-sm flex-1 min-w-0"
        />
      </div>

      <button type="button" onClick={() => setMobileOpen((v) => !v)} className="md:hidden p-1.5 rounded-lg hover:bg-foam" aria-label="Search">
        <Search size={18} className="text-slate" />
      </button>

      {mobileOpen && (
        <div className="fixed inset-x-0 top-0 z-[70] bg-card p-3 border-b border-line flex items-center gap-2 md:hidden">
          <Search size={16} className="text-slate flex-shrink-0" />
          <input
            autoFocus
            value={query}
            onChange={(e) => handleChange(e.target.value)}
            placeholder="Search customers, sales, deliveries…"
            className="bg-transparent outline-none text-sm flex-1 min-w-0"
          />
          <button type="button" onClick={closeAll} aria-label="Close search"><X size={18} /></button>
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
