"use client";
import dynamic from "next/dynamic";

// Leaflet adds a meaningful chunk of JS to any route that loads it, and
// CustomerRiderMap only ever renders while a delivery is actively out for
// this customer (app/portal/(main)/page.js: `outForDelivery && riderLocation`)
// — most portal home visits never show it at all, so shipping Leaflet
// unconditionally on every visit was pure waste. Same ssr:false client-wrapper
// pattern as components/LazyCharts.js (a Server Component can't use ssr:false
// directly), loading the map client-side only when it's actually rendered.
const CustomerRiderMapLazy = dynamic(() => import("./CustomerRiderMap"), {
  ssr: false,
  loading: () => <div className="h-[200px] rounded-2xl border border-line bg-foam flex items-center justify-center text-xs text-slate">Loading map…</div>,
});

export default CustomerRiderMapLazy;
