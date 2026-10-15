"use client";

import { useEffect, useState } from "react";
import { Eye, EyeOff, MapPin } from "lucide-react";
import CustomerRiderMap from "@/components/portal/CustomerRiderMapLazy";

const KEY = "ew-portal-live-map-enabled";

export default function PortalTrackingControl({ riderId, initialLocation }) {
  const [enabled, setEnabled] = useState(true);
  useEffect(() => setEnabled(localStorage.getItem(KEY) !== "false"), []);
  const toggle = () => setEnabled((current) => {
    const next = !current;
    localStorage.setItem(KEY, String(next));
    return next;
  });

  return <section className="mt-2.5 rounded-2xl border border-line bg-card p-3">
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2"><MapPin size={16} className="shrink-0 text-aqua"/><div><p className="text-xs font-bold">Live Rider Location</p><p className="text-[10px] text-slate">{enabled ? "Map is visible on this device" : "Map is hidden on this device"}</p></div></div>
      <button type="button" onClick={toggle} role="switch" aria-checked={enabled} className={`inline-flex min-h-9 items-center gap-1.5 rounded-xl px-3 text-[11px] font-bold ${enabled ? "bg-greenSoft text-green" : "bg-foam text-slate"}`}>{enabled ? <Eye size={14}/> : <EyeOff size={14}/>} {enabled ? "ON" : "OFF"}</button>
    </div>
    {enabled ? <div className="mt-3"><CustomerRiderMap riderId={riderId} initialLocation={initialLocation}/></div> : null}
  </section>;
}
