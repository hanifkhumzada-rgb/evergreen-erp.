import Link from "next/link";
import { Truck, ChevronRight, ChevronLeft } from "lucide-react";
import ListFilterBar from "@/components/ListFilterBar";
import { DocumentActionBar } from "@/components/ui";
import { portalDeliveryFilters, portalDeliveriesQuery, deliveryItemsText } from "@/lib/portal/listQueries";
import { exportPortalDeliveries } from "@/lib/portal/exportActions";
import { requirePortalCustomer } from "@/lib/portal/session";
import { fmtDate, pkr } from "@/lib/format";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;
const STATUS_TONE = { delivered: "bg-greenSoft text-green", pending: "bg-amberSoft text-amber", cancelled: "bg-coralSoft text-coral", assigned: "bg-aquaSoft text-aqua", out_for_delivery: "bg-aquaSoft text-aqua" };

function hrefFor({ status, q, month, page }) {
  const params = new URLSearchParams();
  if (status && status !== "all") params.set("status", status);
  if (q) params.set("q", q);
  if (month) params.set("month", month);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return `/portal/deliveries${query ? `?${query}` : ""}`;
}

export default async function PortalDeliveriesPage({ searchParams }) {
  const { supabase, customerId } = await requirePortalCustomer();
  const filters = portalDeliveryFilters(searchParams || {});
  const { status, q, month } = filters;
  const page = Math.max(1, Number(searchParams?.page) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const { data: deliveries, count } = await portalDeliveriesQuery(supabase, customerId, filters, { count: true }).range(from, from + PAGE_SIZE - 1);
  const pdfParams = new URLSearchParams({ kind: "deliveries", ...(status !== "all" && { status }), ...(q && { q }), ...(month && { month }) });
  const totalPages = Math.max(1, Math.ceil((count || 0) / PAGE_SIZE));

  return (
    <div className="flex flex-col gap-4">
      <div><h1 className="font-display text-xl font-semibold">My Deliveries</h1><p className="text-xs text-slate mt-1">Every delivery stays saved by date, quantity and reference.</p></div>

      <ListFilterBar className="!mb-0" placeholder="Search delivery reference" dateFilters={[{ name: "month", label: "Month", type: "month" }]} />
      <div className="flex flex-wrap gap-2">
        <DocumentActionBar
          print
          pdfHref={`/api/pdf/portal-list?${pdfParams}`}
          pdfLabel="PDF"
          excel={{ loadRows: exportPortalDeliveries.bind(null, filters), sheetName: "My Deliveries", reportTitle: "My Deliveries" }}
          share={{ title: "My Deliveries" }}
        />
      </div>

      <div className="flex gap-2 overflow-x-auto no-scrollbar">
        {["all", "delivered", "pending", "cancelled"].map((s) => (
          <Link key={s} href={hrefFor({ status: s, q, month, page: 1 })}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap flex-shrink-0 ${status === s ? "bg-navy text-white" : "bg-card border border-line text-slate"}`}>
            {s === "all" ? "All" : s[0].toUpperCase() + s.slice(1)}
          </Link>
        ))}
      </div>

      <div className="flex flex-col gap-2.5">
        {(deliveries || []).length === 0 && <div className="bg-card border border-line rounded-2xl p-6 text-xs text-slate text-center">No matching deliveries found. Try another month or clear the search.</div>}
        {(deliveries || []).map((d) => (
          <Link key={d.id} href={`/portal/deliveries/${d.id}`} className="bg-card border border-line rounded-2xl p-4 flex items-center justify-between hover:border-aqua/40 transition-colors">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Truck size={14} className="text-aqua flex-shrink-0" />
                <span className="text-sm font-bold truncate">{d.delivery_no}</span>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize flex-shrink-0 ${STATUS_TONE[d.status] || "bg-foam text-slate"}`}>{String(d.status).replaceAll("_", " ")}</span>
              </div>
              <div className="text-[11px] text-slate mt-1">{fmtDate(d.delivery_date)} · {deliveryItemsText(d) || "—"}</div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-sm font-mono-num font-bold">{pkr(d.amount)}</span>
              <ChevronRight size={16} className="text-slate" />
            </div>
          </Link>
        ))}
      </div>

      {(count || 0) > PAGE_SIZE && <div className="flex items-center justify-between rounded-2xl border border-line bg-card p-2">
        <Link aria-disabled={page <= 1} href={hrefFor({ status, q, month, page: Math.max(1, page - 1) })} className={`flex items-center gap-1 rounded-xl px-3 py-2 text-xs font-bold ${page <= 1 ? "pointer-events-none text-slate/40" : "text-aqua hover:bg-aquaSoft"}`}><ChevronLeft size={14}/>Previous</Link>
        <span className="text-[11px] text-slate">Page {Math.min(page, totalPages)} of {totalPages}</span>
        <Link aria-disabled={page >= totalPages} href={hrefFor({ status, q, month, page: Math.min(totalPages, page + 1) })} className={`flex items-center gap-1 rounded-xl px-3 py-2 text-xs font-bold ${page >= totalPages ? "pointer-events-none text-slate/40" : "text-aqua hover:bg-aquaSoft"}`}>Next<ChevronRight size={14}/></Link>
      </div>}
    </div>
  );
}
