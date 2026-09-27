"use client";

import { Search, X, Loader2 } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

// One filter bar for every list page (staff app and Customer Portal):
// - the search box narrows results as you type (debounced, no submit)
// - dropdowns / dates apply the moment they change
// - any other URL params the page uses (tabs, month, sort…) are kept
// - the page number resets to 1 whenever the filter changes
//
// Filtering itself happens on the server (the page reads the URL params),
// so it works with server-side pagination and stays fast at any volume.
//
// props:
//   searchParam   URL param for the search box (default "q"); null hides it
//   placeholder   search placeholder
//   filters       [{ name, label, options: [{ value, label }] }] dropdowns
//   dateFilters   [{ name, label, type? }] date inputs (type "month" for a month picker)
//   pageParam     URL param holding the page number (default "page")
export default function ListFilterBar({
  searchParam = "q", placeholder = "Search…", filters = [], dateFilters = [], pageParam = "page", className = "",
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const current = searchParam ? searchParams.get(searchParam) || "" : "";
  const [query, setQuery] = useState(current);
  const lastApplied = useRef(current);

  // Keep the box in sync with back/forward navigation.
  useEffect(() => {
    if (current !== lastApplied.current) { lastApplied.current = current; setQuery(current); }
  }, [current]);

  const apply = (changes) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(changes)) {
      const v = String(value ?? "").trim();
      if (v) params.set(key, v); else params.delete(key);
    }
    params.delete(pageParam);
    const qs = params.toString();
    startTransition(() => router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false }));
  };

  useEffect(() => {
    if (!searchParam || query.trim() === lastApplied.current.trim()) return undefined;
    const timer = setTimeout(() => {
      lastApplied.current = query.trim();
      apply({ [searchParam]: query });
    }, 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const managed = [searchParam, ...filters.map((f) => f.name), ...dateFilters.map((f) => f.name)].filter(Boolean);
  const hasActive = managed.some((k) => searchParams.get(k));

  return (
    <div className={`no-print mb-4 flex flex-wrap items-center gap-2.5 ${className}`} role="search">
      {searchParam && (
        <div className="relative w-full sm:w-72">
          {pending
            ? <Loader2 size={16} aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 animate-spin text-aqua" />
            : <Search size={16} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate" />}
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); lastApplied.current = query.trim(); apply({ [searchParam]: query }); } }}
            placeholder={placeholder}
            aria-label={placeholder}
            className="w-full rounded-xl border border-line bg-card py-2 pl-9 pr-10 text-xs outline-none focus:border-aqua focus:ring-4 focus:ring-aqua/10"
          />
          {query && (
            <button type="button" aria-label="Clear search" onClick={() => { setQuery(""); lastApplied.current = ""; apply({ [searchParam]: "" }); }}
              className="absolute right-0.5 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center text-slate hover:text-ink">
              <X size={15} />
            </button>
          )}
        </div>
      )}
      {filters.map((f) => (
        <select key={f.name} aria-label={f.label} value={searchParams.get(f.name) || ""} onChange={(e) => apply({ [f.name]: e.target.value })}
          className="min-h-[38px] rounded-xl border border-line bg-card px-3 py-2 text-xs">
          <option value="">{f.label}</option>
          {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ))}
      {dateFilters.map((f) => (
        <label key={f.name} className="flex items-center gap-1.5 text-xs text-slate">
          {f.label}
          <input type={f.type || "date"} value={searchParams.get(f.name) || ""} onChange={(e) => apply({ [f.name]: e.target.value })}
            className="min-h-[38px] rounded-xl border border-line bg-card px-3 py-2 text-xs text-ink" />
        </label>
      ))}
      {hasActive && (
        <button type="button" onClick={() => { setQuery(""); lastApplied.current = ""; apply(Object.fromEntries(managed.map((k) => [k, ""]))); }}
          className="min-h-[38px] rounded-xl px-2 text-xs text-slate hover:text-aqua">
          Clear filters
        </button>
      )}
    </div>
  );
}
