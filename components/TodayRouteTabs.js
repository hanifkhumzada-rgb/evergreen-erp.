"use client";

import { useMemo, useState } from "react";
import Link from "@/components/ErpNavLink";
import { CheckCircle2, Clock3, XCircle } from "lucide-react";

const STATUS = {
  delivered: { label: "Delivered", icon: CheckCircle2, cls: "bg-greenSoft text-green" },
  missed: { label: "Missed", icon: XCircle, cls: "bg-coralSoft text-coral" },
  failed: { label: "Missed", icon: XCircle, cls: "bg-coralSoft text-coral" },
  cancelled: { label: "Missed", icon: XCircle, cls: "bg-coralSoft text-coral" },
};

export default function TodayRouteTabs({ deliveries = [] }) {
  const zones = useMemo(() => [...new Set(deliveries.map((d) => d.zone || "Unassigned"))], [deliveries]);
  const [active, setActive] = useState(zones[0] || "All");
  const rows = deliveries.filter((d) => (d.zone || "Unassigned") === active);

  if (!deliveries.length) return <div className="rounded-2xl border border-dashed border-line bg-card px-4 py-8 text-center text-sm text-slate">No deliveries scheduled for today.</div>;

  return (
    <div className="rounded-2xl border border-line bg-card">
      <div className="nav-scroll flex gap-1 overflow-x-auto border-b border-line p-2">
        {zones.map((zone) => (
          <button key={zone} type="button" onClick={() => setActive(zone)} className={`whitespace-nowrap rounded-xl px-3 py-2 text-xs font-bold ${active === zone ? "bg-navy text-white" : "text-slate hover:bg-foam"}`}>{zone}</button>
        ))}
      </div>
      <div className="max-h-72 divide-y divide-line overflow-y-auto">
        {rows.map((d) => {
          const status = STATUS[d.status] || { label: "Pending", icon: Clock3, cls: "bg-amberSoft text-amber" };
          const Icon = status.icon;
          return (
            <Link href={`/customers/${d.customerId}`} key={d.id} className="grid grid-cols-[52px_minmax(0,1fr)_auto] items-center gap-3 px-3.5 py-3 hover:bg-foam">
              <span className="font-mono-num text-[11px] text-slate">{d.time}</span>
              <span className="min-w-0"><strong className="block truncate text-sm">{d.customer}</strong><span className="text-[11px] text-slate">{d.qty} bottle{d.qty === 1 ? "" : "s"} · {d.reference}</span></span>
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold ${status.cls}`}><Icon size={11} /> {status.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
