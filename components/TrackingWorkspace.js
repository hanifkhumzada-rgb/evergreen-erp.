"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Activity, Clock3, MapPin, Navigation, RefreshCw, Route, Search, Signal, Truck } from "lucide-react";
import LiveTrackingMap from "@/components/LiveTrackingMap";
import LocationPermissionCard from "@/components/LocationPermissionCard";

const STALE_MS = 5 * 60 * 1000;
const qty = (d) => (d.delivery_items || []).reduce((sum, item) => sum + Number(item.delivered_qty ?? item.expected_qty ?? 0), 0);
const fresh = (location) => location && Date.now() - new Date(location.recorded_at).getTime() <= STALE_MS;

function Kpi({ label, value, tone = "text-navy", icon: Icon }) {
  return <div className="rounded-2xl border border-line bg-card p-3"><div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-slate"><Icon size={12}/>{label}</div><div className={`mt-1 text-xl font-bold ${tone}`}>{value}</div></div>;
}

function DeliveryList({ deliveries }) {
  if (!deliveries.length) return <div className="rounded-2xl border border-line bg-card p-5 text-center text-xs text-slate">No assigned deliveries for today.</div>;
  return <div className="space-y-2">{deliveries.map((delivery, index) => {
    const customer = delivery.customers;
    return <div key={delivery.id} className="rounded-2xl border border-line bg-card p-3.5">
      <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-[10px] font-bold text-aqua">STOP {index + 1} · {delivery.delivery_no}</p><p className="truncate text-sm font-bold">{customer?.name || "Customer"}</p><p className="mt-0.5 text-[11px] text-slate">{[customer?.address, customer?.area, customer?.zones?.name].filter(Boolean).join(", ") || "Address not available"}</p></div><span className={`rounded-full px-2 py-1 text-[10px] font-bold capitalize ${delivery.status === "delivered" ? "bg-greenSoft text-green" : "bg-amberSoft text-amber"}`}>{String(delivery.status).replaceAll("_", " ")}</span></div>
      <div className="mt-3 flex items-center justify-between border-t border-line pt-2.5 text-xs"><span>{qty(delivery)} bottle(s) · {customer?.routes?.name || "No route"}</span><Link href={`/deliveries?customer=${customer?.id || ""}`} className="rounded-xl bg-navy px-3 py-2 font-bold text-white">Open Delivery</Link></div>
    </div>;
  })}</div>;
}

export default function TrackingWorkspace({ roleKey, canMonitor, currentUser, riders, deliveries, routes, historyCount }) {
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  const riderMode = roleKey === "rider";
  const [tab, setTab] = useState(riderMode ? "duty" : "control");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(riders[0]?.id || null);
  const filtered = useMemo(() => riders.filter((r) => `${r.name} ${r.route} ${r.zone}`.toLowerCase().includes(query.toLowerCase())), [riders, query]);
  const selected = riders.find((r) => r.id === selectedId) || filtered[0];
  const active = riders.filter((r) => fresh(r.location)).length;
  const completed = deliveries.filter((d) => d.status === "delivered").length;
  const pending = deliveries.filter((d) => !["delivered", "cancelled", "void", "missed"].includes(d.status)).length;
  const skipped = deliveries.filter((d) => ["missed", "cancelled"].includes(d.status)).length;
  const tabs = riderMode ? [["duty", "My Duty"], ["route", "My Route"]] : [["control", "Live Control"], ["routes", "Route Progress"], ["history", "History"]];

  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-aqua">Live Tracking & Routes</p><h1 className="font-display text-2xl font-semibold">{riderMode ? `My Duty · ${currentUser.name}` : "Live Control Center"}</h1><p className="mt-1 text-xs text-slate">Foreground GPS for Chrome and installed EW app. Locked-screen tracking is not guaranteed.</p></div><button type="button" disabled={refreshing} onClick={() => startRefresh(() => router.refresh())} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-line bg-card px-3 text-xs font-bold disabled:cursor-wait disabled:opacity-60"><RefreshCw size={15} className={refreshing ? "animate-spin" : ""}/>{refreshing ? "Refreshing…" : "Refresh live data"}</button></div>
    <div className="flex gap-1 overflow-x-auto rounded-2xl border border-line bg-card p-1">{tabs.map(([key,label]) => <button key={key} onClick={() => setTab(key)} className={`min-h-10 flex-1 whitespace-nowrap rounded-xl px-3 text-xs font-bold ${tab === key ? "bg-navy text-white" : "text-slate"}`}>{label}</button>)}</div>
    {riderMode && tab === "duty" ? <><LocationPermissionCard/><div className="grid grid-cols-2 gap-2 sm:grid-cols-4"><Kpi label="Total" value={deliveries.length} icon={Truck}/><Kpi label="Done" value={completed} icon={Activity} tone="text-green"/><Kpi label="Pending" value={pending} icon={Clock3} tone="text-amber"/><Kpi label="Skipped" value={skipped} icon={MapPin} tone="text-coral"/></div><DeliveryList deliveries={deliveries}/></> : null}
    {riderMode && tab === "route" ? <><div className="rounded-2xl border border-aqua/20 bg-aquaSoft p-4"><p className="text-xs font-bold">Assigned route</p><p className="mt-1 text-lg font-semibold">{routes.map((r) => r.name).join(", ") || "No route assigned"}</p></div><DeliveryList deliveries={deliveries}/></> : null}
    {canMonitor && tab === "control" ? <><div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6"><Kpi label="Active Riders" value={active} icon={Signal} tone="text-green"/><Kpi label="On Duty" value={active} icon={Navigation}/><Kpi label="Offline / Stale" value={riders.length-active} icon={Clock3} tone="text-amber"/><Kpi label="Assigned" value={deliveries.length} icon={Truck}/><Kpi label="Completed" value={completed} icon={Activity} tone="text-green"/><Kpi label="Pending" value={pending} icon={Route} tone="text-amber"/></div><div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]"><LiveTrackingMap riders={filtered}/><aside className="rounded-2xl border border-line bg-card p-3"><label className="relative block"><Search size={14} className="absolute left-3 top-3 text-slate"/><input value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="Search rider, route or zone" className="w-full rounded-xl border border-line bg-foam py-2.5 pl-9 pr-3 text-xs outline-none"/></label><div className="mt-3 max-h-[300px] space-y-2 overflow-y-auto">{filtered.map((r)=><button key={r.id} onClick={()=>setSelectedId(r.id)} className={`w-full rounded-xl border p-3 text-left ${selected?.id===r.id ? "border-aqua bg-aquaSoft" : "border-line"}`}><div className="flex justify-between gap-2"><span className="text-xs font-bold">{r.name}</span><span className={`text-[10px] font-bold ${fresh(r.location)?"text-green":"text-slate"}`}>{fresh(r.location)?"LIVE":r.location?"STALE":"OFFLINE"}</span></div><p className="mt-1 text-[10px] text-slate">{r.route} · {r.deliveries.filter(d=>d.status==="delivered").length}/{r.deliveries.length} complete</p></button>)}</div>{selected ? <div className="mt-3 rounded-xl bg-foam p-3 text-[11px]"><p className="text-sm font-bold">{selected.name}</p><p className="mt-1 text-slate">ID: {selected.code || "—"} · Zone: {selected.zone}</p><p className="text-slate">Route: {selected.route}</p><p className="text-slate">Last seen: {selected.location ? new Date(selected.location.recorded_at).toLocaleString() : "No GPS received"}</p><div className="mt-3 flex gap-2"><Link href={`/deliveries?rider=${selected.id}`} className="rounded-lg bg-navy px-3 py-2 font-bold text-white">View Deliveries</Link>{selected.mobile ? <a href={`tel:${selected.mobile}`} className="rounded-lg border border-line bg-card px-3 py-2 font-bold">Contact</a> : null}</div></div> : null}</aside></div></> : null}
    {canMonitor && tab === "routes" ? <div className="space-y-2">{riders.map((r) => { const done=r.deliveries.filter(d=>d.status==="delivered").length,total=r.deliveries.length; return <div key={r.id} className="rounded-2xl border border-line bg-card p-4"><div className="flex justify-between gap-3"><div><p className="text-sm font-bold">{r.route}</p><p className="text-[11px] text-slate">{r.name} · {r.zone}</p></div><strong className="text-sm">{done}/{total}</strong></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-foam"><div className="h-full bg-aqua" style={{width:`${total?Math.round(done/total*100):0}%`}}/></div></div>; })}</div> : null}
    {canMonitor && tab === "history" ? <div className="rounded-2xl border border-line bg-card p-5"><h2 className="text-sm font-bold">Tracking History</h2><p className="mt-1 text-xs text-slate">{historyCount} GPS updates retained in the last 24 hours. Detailed trip replay is not enabled; current retention remains privacy-limited.</p></div> : null}
  </div>;
}
