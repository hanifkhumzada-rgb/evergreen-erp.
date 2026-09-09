import Link from "next/link";
import { Truck, ChevronRight } from "lucide-react";
import { requirePortalCustomer } from "@/app/portal/actions";
import { fmtDate, pkr } from "@/lib/format";

export const dynamic = "force-dynamic";

const STATUS_TONE = { delivered: "bg-greenSoft text-green", pending: "bg-amberSoft text-amber", cancelled: "bg-coralSoft text-coral", assigned: "bg-aquaSoft text-aqua" };

export default async function PortalDeliveriesPage({ searchParams }) {
  const { supabase, customerId } = await requirePortalCustomer();
  const status = searchParams?.status || "all";

  let query = supabase.from("deliveries").select("id, delivery_no, delivery_date, status, amount, delivery_items(delivered_qty, returned_qty, products(name))")
    .eq("customer_id", customerId).order("delivery_date", { ascending: false }).limit(100);
  if (status !== "all") query = query.eq("status", status);
  const { data: deliveries } = await query;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-display text-xl font-semibold">My Deliveries</h1>

      <div className="flex gap-2 overflow-x-auto no-scrollbar">
        {["all", "delivered", "pending", "cancelled"].map((s) => (
          <Link key={s} href={s === "all" ? "/portal/deliveries" : `/portal/deliveries?status=${s}`}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap flex-shrink-0 ${status === s ? "bg-navy text-white" : "bg-card border border-line text-slate"}`}>
            {s === "all" ? "All" : s[0].toUpperCase() + s.slice(1)}
          </Link>
        ))}
      </div>

      <div className="flex flex-col gap-2.5">
        {(deliveries || []).length === 0 && <div className="bg-card border border-line rounded-2xl p-5 text-xs text-slate text-center">No deliveries found.</div>}
        {(deliveries || []).map((d) => (
          <Link key={d.id} href={`/portal/deliveries/${d.id}`} className="bg-card border border-line rounded-2xl p-4 flex items-center justify-between hover:border-aqua/40 transition-colors">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Truck size={14} className="text-aqua flex-shrink-0" />
                <span className="text-sm font-bold truncate">{d.delivery_no}</span>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize flex-shrink-0 ${STATUS_TONE[d.status] || "bg-foam text-slate"}`}>{d.status}</span>
              </div>
              <div className="text-[11px] text-slate mt-1">{fmtDate(d.delivery_date)} · {(d.delivery_items || []).map((i) => `${i.products?.name || "Item"} ×${i.delivered_qty}`).join(", ") || "—"}</div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-sm font-mono-num font-bold">{pkr(d.amount)}</span>
              <ChevronRight size={16} className="text-slate" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
