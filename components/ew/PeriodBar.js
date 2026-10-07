"use client";
import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { PRESETS, presetRange } from "@/lib/ew/dates";

// Date-range presets (Today … This Year, Custom) that rewrite ?range/from/to
// in place — the server re-renders the document/report for the new period.
// `extra` adds presets such as { key: "all", label: "All Time" }.
export default function PeriodBar({ current = "month", from = "", to = "", extra = [], omit = [], compact = false }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [pending, start] = useTransition();
  const presets = [...PRESETS.filter((p) => !omit.includes(p.key)), ...extra];

  const go = (changes) => {
    const params = new URLSearchParams(sp.toString());
    Object.entries(changes).forEach(([k, v]) => (v ? params.set(k, v) : params.delete(k)));
    params.delete("page");
    params.delete("month"); // a picked period replaces a month filter
    start(() => router.replace(`${pathname}?${params.toString()}`, { scroll: false }));
  };

  const pick = (key) => {
    if (key === "custom") {
      const r = from || to ? { from, to } : presetRange("month");
      go({ range: "custom", from: r.from, to: r.to });
    } else go({ range: key, from: "", to: "" });
  };

  return (
    <div className={`flex flex-wrap items-center gap-2 ${compact ? "" : "w-full"}`}>
      <div className="ew-presets" role="tablist" aria-label="Date range">
        {presets.map((p) => (
          <button key={p.key} type="button" role="tab" aria-selected={current === p.key} onClick={() => pick(p.key)}
            className={`ew-preset ${current === p.key ? "ew-preset-on" : ""}`}>{p.label}</button>
        ))}
      </div>
      {current === "custom" ? (
        <span className="flex items-center gap-1.5">
          <input type="date" aria-label="From date" className="ew-input" value={from} onChange={(e) => go({ range: "custom", from: e.target.value, to })} />
          <span className="text-xs text-slate">to</span>
          <input type="date" aria-label="To date" className="ew-input" value={to} onChange={(e) => go({ range: "custom", from, to: e.target.value })} />
        </span>
      ) : null}
      {pending ? <Loader2 size={16} className="animate-spin text-aqua" aria-label="Loading" /> : null}
    </div>
  );
}
