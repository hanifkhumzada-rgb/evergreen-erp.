"use client";
import dynamic from "next/dynamic";

// Recharts adds a meaningful chunk of JS (~100kB) to any route that loads
// it — dynamic-importing with ssr:false keeps that out of the initial
// server-rendered payload for Dashboard and the Customer 360 profile,
// loading it client-side only once the rest of the page is interactive.
// A Server Component can't use ssr:false directly, hence this small client
// wrapper (the standard Next.js pattern for lazy-loading a client chart
// from a server page).
const ChartSkeleton = () => <div className="h-[220px] flex items-center justify-center text-xs text-slate">Loading chart…</div>;

export const SalesTrendChart = dynamic(() => import("./DashboardCharts").then((m) => m.SalesTrendChart), {
  ssr: false,
  loading: ChartSkeleton,
});

export const ExpensePie = dynamic(() => import("./DashboardCharts").then((m) => m.ExpensePie), {
  ssr: false,
  loading: ChartSkeleton,
});
