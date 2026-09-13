import Link from "next/link";
import { Search, PencilLine } from "lucide-react";
import { getCurrentProfile } from "@/lib/session";
import { fmtDate, pkr } from "@/lib/format";
import { Badge, Th, Td } from "@/components/ui";
import DeliveryCorrectionForm from "@/components/DeliveryCorrectionForm";
import RecordPreview from "@/components/RecordPreview";

export const dynamic = "force-dynamic";

export default async function DeliveryCorrectionsPage({ searchParams }) {
  const sp = (await searchParams) || {};
  const q = (sp.q || "").trim();
  const month = /^\d{4}-\d{2}$/.test(sp.month || "") ? sp.month : new Date().toISOString().slice(0, 7);
  const from = `${month}-01`;
  const untilDate = new Date(`${from}T00:00:00Z`);
  untilDate.setUTCMonth(untilDate.getUTCMonth() + 1);
  const until = untilDate.toISOString().slice(0, 10);

  const { supabase } = await getCurrentProfile();
  const [{ data: deliveries }, { data: canEdit }] = await Promise.all([
    supabase.from("deliveries")
      .select("id, delivery_no, delivery_date, status, amount, amount_collected, rider_remarks, customers(id,name,code,mobile), profiles!deliveries_rider_id_fkey(full_name), delivery_items(product_id,delivered_qty,returned_qty,unit_price,products(name,sku))")
      .gte("delivery_date", from).lt("delivery_date", until)
      .in("status", ["delivered", "partially_delivered"])
      .order("delivery_date", { ascending: false }).limit(1000),
    supabase.rpc("fn_has_permission", { perm_key: "deliveries.edit" }),
  ]);

  const rows = (deliveries || []).filter((d) => {
    if (!q) return true;
    return `${d.delivery_no || ""} ${d.customers?.name || ""} ${d.customers?.code || ""} ${d.customers?.mobile || ""}`.toLowerCase().includes(q.toLowerCase());
  });

  return <div>
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-4">
      <div><div className="flex items-center gap-2"><PencilLine size={21} className="text-aqua"/><h1 className="font-display text-2xl font-semibold">Delivery Corrections</h1></div><p className="text-sm text-slate mt-1">Wrong bottle entry ko safely correct karein. Bottle balance aur customer ledger auto-adjust hota hai.</p></div>
      <Link href="/deliveries" className="no-print px-3 py-2 rounded-xl border border-line bg-card text-xs font-bold hover:bg-foam">Back to Deliveries</Link>
    </div>

    <form action="/delivery-corrections" className="no-print mb-5 flex flex-wrap items-center gap-2 rounded-2xl border border-line bg-card p-3">
      <div className="relative min-w-[240px] flex-1"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate"/><input name="q" defaultValue={q} placeholder="Search customer, ID, phone, delivery no…" className="w-full rounded-xl border border-line bg-foam/40 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-aqua"/></div>
      <input type="month" name="month" defaultValue={month} className="rounded-xl border border-line bg-card px-3 py-2.5 text-sm"/>
      <button type="submit" className="inline-flex items-center gap-1.5 rounded-xl bg-aqua px-4 py-2.5 text-xs font-bold text-white"><Search size={14}/> Search</button>
      {(q || sp.month) && <Link href="/delivery-corrections" className="text-xs font-semibold text-slate hover:text-aqua">Clear</Link>}
    </form>

    {!canEdit && <div className="mb-4 rounded-xl border border-amber/20 bg-amberSoft p-3 text-xs text-amber">Your role can view this workspace but cannot correct deliveries.</div>}

    <div className="overflow-x-auto rounded-2xl border border-line bg-card">
      <table className="w-full min-w-[900px] text-[13px] border-collapse">
        <thead><tr className="bg-foam"><Th>Date</Th><Th>Delivery</Th><Th>Customer</Th><Th>Delivered</Th><Th>Returned</Th><Th>Amount</Th><Th>Collected</Th><Th>Rider</Th><Th>Actions</Th></tr></thead>
        <tbody>
          {rows.length === 0 && <tr><td colSpan={9} className="py-10 text-center text-sm text-slate">No completed deliveries found for this selection.</td></tr>}
          {rows.map((d) => {
            const delivered = (d.delivery_items || []).reduce((sum, item) => sum + Number(item.delivered_qty || 0), 0);
            const returned = (d.delivery_items || []).reduce((sum, item) => sum + Number(item.returned_qty || 0), 0);
            const items = (d.delivery_items || []).map((item) => ({ product_id: item.product_id, product_name: item.products?.name || item.products?.sku || "Bottle", delivered_qty: item.delivered_qty, returned_qty: item.returned_qty, unit_price: item.unit_price }));
            const previewFields = [
              { label: "Delivery No", value: d.delivery_no, emphasis: true },
              { label: "Date", value: fmtDate(d.delivery_date) },
              { label: "Customer", value: d.customers?.name },
              { label: "Customer ID", value: d.customers?.code },
              { label: "Delivered", value: delivered },
              { label: "Returned", value: returned },
              { label: "Amount", value: pkr(d.amount) },
              { label: "Collected", value: pkr(d.amount_collected) },
              { label: "Delivery Boy", value: d.profiles?.full_name || "—" },
              { label: "Notes", value: d.rider_remarks || "—", fullWidth: true },
            ];
            return <tr key={d.id} className="hover:bg-foam/70"><Td>{fmtDate(d.delivery_date)}</Td><Td className="font-mono-num">{d.delivery_no}</Td><Td><div className="font-semibold">{d.customers?.name}</div><div className="text-[10px] text-slate">{d.customers?.code}</div></Td><Td><Badge text={String(delivered)} tone="aqua"/></Td><Td>{returned}</Td><Td>{pkr(d.amount)}</Td><Td>{pkr(d.amount_collected)}</Td><Td>{d.profiles?.full_name || "—"}</Td><Td><div className="flex gap-1.5"><RecordPreview iconOnly title={`${d.delivery_no} · ${d.customers?.name}`} subtitle="Read-only delivery preview" fields={previewFields} excelRows={[{ Date: d.delivery_date, Delivery: d.delivery_no, Customer: d.customers?.name, Delivered: delivered, Returned: returned, Amount: Number(d.amount || 0), Collected: Number(d.amount_collected || 0), Rider: d.profiles?.full_name || "" }]} excelTitle={d.delivery_no}/>{canEdit && <DeliveryCorrectionForm delivery={{ id: d.id, delivery_no: d.delivery_no, customer_name: d.customers?.name, delivery_items: items }}/>}</div></Td></tr>;
          })}
        </tbody>
      </table>
    </div>
  </div>;
}
