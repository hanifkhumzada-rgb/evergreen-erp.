import Link from "next/link";
import { Search, Truck, ChevronRight, ChevronLeft, CalendarDays } from "lucide-react";
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
  const status = String(searchParams?.status || "all");
  const q = String(searchParams?.q || "").trim().slice(0, 50);
  const month = /^\d{4}-\d{2}$/.test(String(searchParams?.month || "")) ? String(searchParams.month) : "";
  const page = Math.max(1, Number(searchParams?.page) || 1);
  const from = (page - 1) * PAGE_SIZE;

  let query = supabase.from("deliveries")
    .select("id, delivery_no, delivery_date, status, amount, delivery_items(delivered_qty, returned_qty, products(name))", { count: "exact" })
    .eq("customer_id", customerId)
    .order("delivery_date", { ascending: false })
    .order("created_at", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);

  if (status !== "all") query = query.eq("status", status);
  if (q) query = query.ilike("delivery_no", `%${q.replace(/[%_,()]/g, "")}%`);
  if (month) {
    const [year, monthNumber] = month.split("-").map(Number);
    const next = new Date(Date.UTC(year, monthNumber, 1)).toISOString().slice(0, 10);
    query = query.gte("delivery_date", `${month}-01`).lt("delivery_date", next);
  }

  const { data: deliveries, count } = await query;
  const totalPages = Math.max(1, Math.ceil((count || 0) / PAGE_SIZE));

  return (
    <div className="flex flex-col gap-4">
      <div><h1 className="font-display text-xl font-semibold">My Deliveries</h1><p className="text-xs text-slate mt-1">Every delivery stays saved by date, quantity and reference.</p></div>

      <form className="grid grid-cols-[1fr_auto] gap-2 rounded-2xl border border-line bg-card p-2" action="/portal/deliveries">
        {status !== "all" && <input type="hidden" name="status" value={status} />}
        <label className="relative min-w-0"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate"/><input name="q" defaultValue={q} placeholder="Search delivery reference" className="w-full rounded-xl border border-line bg-foam py-2.5 pl-9 pr-3 text-xs outline-none focus:border-aqua"/></label>
        <button className="rounded-xl bg-navy px-4 text-xs font-bold text-white">Search</button>
        <label className="relative col-span-2"><CalendarDays size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate"/><input type="month" name="month" defaultValue={month} className="w-full rounded-xl border border-line bg-card py-2.5 pl-9 pr-3 text-xs"/></label>
      </form>

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
              <div className="text-[11px] text-slate mt-1">{fmtDate(d.delivery_date)} · {(d.delivery_items || []).map((i) => `${i.products?.name || "Item"} ×${i.delivered_qty}`).join(", ") || "—"}</div>
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
