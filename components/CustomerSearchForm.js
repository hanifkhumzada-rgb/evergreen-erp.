"use client";

import { Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export default function CustomerSearchForm({ initialQuery = "", zone = "", type = "", status = "", zones = [], types = [] }) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [pending, startTransition] = useTransition();

  const navigate = (formData) => {
    const params = new URLSearchParams();
    for (const key of ["q", "zone", "type", "status"]) {
      const value = String(formData.get(key) || "").trim();
      if (value) params.set(key, value);
    }
    startTransition(() => router.replace(`/customers${params.size ? `?${params}` : ""}`));
  };

  const clearSearch = () => {
    setQuery("");
    const params = new URLSearchParams();
    if (zone) params.set("zone", zone);
    if (type) params.set("type", type);
    if (status) params.set("status", status);
    startTransition(() => router.replace(`/customers${params.size ? `?${params}` : ""}`));
  };

  return (
    <form className="no-print flex flex-wrap gap-2.5 mb-4 items-center" action={navigate}>
      <div className="relative w-full sm:w-72">
        <Search size={16} aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate pointer-events-none" />
        <input
          type="search"
          name="q"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search name, ID, phone, area, route…"
          aria-label="Search customers"
          className="w-full pl-9 pr-9 py-2 rounded-xl border border-line bg-card text-xs outline-none focus:border-aqua focus:ring-4 focus:ring-aqua/10"
        />
        {query && (
          <button type="button" onClick={clearSearch} aria-label="Clear customer search" className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate hover:text-ink">
            <X size={15} />
          </button>
        )}
      </div>
      <select name="zone" defaultValue={zone} className="px-3 py-2 rounded-xl border border-line bg-card text-xs">
        <option value="">All zones</option>
        {zones.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select>
      <select name="type" defaultValue={type} className="px-3 py-2 rounded-xl border border-line bg-card text-xs">
        <option value="">All types</option>
        {types.map((item) => <option key={item} value={item}>{item}</option>)}
      </select>
      <select name="status" defaultValue={status} className="px-3 py-2 rounded-xl border border-line bg-card text-xs">
        <option value="">All statuses</option>
        <option value="active">Active</option>
        <option value="inactive">Inactive</option>
        <option value="on_hold">On Hold</option>
        <option value="blacklisted">Blacklisted</option>
        <option value="archived">Archived</option>
      </select>
      <button type="submit" disabled={pending} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-navy text-white text-xs font-semibold disabled:opacity-60">
        <Search size={14} /> {pending ? "Searching…" : "Search"}
      </button>
    </form>
  );
}
