import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Truck } from "lucide-react";
import { requirePortalCustomer } from "@/app/portal/actions";
import { fmtDate, pkr } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function PortalDeliveryDetailPage({ params }) {
  const { supabase, customerId } = await requirePortalCustomer();

  const { data: delivery } = await supabase.from("deliveries")
    .select("*, delivery_items(delivered_qty, expected_qty, returned_qty, unit_price, amount, products(name, size_label)), profiles(full_name)")
    .eq("id", params.id).eq("customer_id", customerId).maybeSingle();

  if (!delivery) notFound();

  return (
    <div className="flex flex-col gap-4">
      <Link href="/portal/deliveries" className="flex items-center gap-1 text-xs text-slate"><ArrowLeft size={13} /> Back to deliveries</Link>

      <div className="bg-card border border-line rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-1">
          <Truck size={16} className="text-aqua" />
          <h1 className="font-display text-lg font-semibold">{delivery.delivery_no}</h1>
        </div>
        <p className="text-xs text-slate">{fmtDate(delivery.delivery_date)} · <span className="capitalize">{delivery.status}</span></p>
        {delivery.profiles?.full_name && <p className="text-xs text-slate mt-1">Delivered by {delivery.profiles.full_name}</p>}
      </div>

      <div className="bg-card border border-line rounded-2xl p-5">
        <h2 className="text-xs font-bold text-slate uppercase tracking-wide mb-3">Items</h2>
        <div className="flex flex-col gap-2.5">
          {(delivery.delivery_items || []).map((item, i) => (
            <div key={i} className="flex items-center justify-between text-sm border-b border-line last:border-0 pb-2.5 last:pb-0">
              <div>
                <div className="font-semibold">{item.products?.name} {item.products?.size_label ? `(${item.products.size_label})` : ""}</div>
                <div className="text-[11px] text-slate mt-0.5">Delivered {item.delivered_qty} · Returned {item.returned_qty || 0}</div>
              </div>
              <div className="font-mono-num font-semibold">{pkr(item.amount)}</div>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-line">
          <span className="text-sm font-bold">Total</span>
          <span className="text-sm font-mono-num font-bold">{pkr(delivery.amount)}</span>
        </div>
      </div>

      {delivery.customer_remarks && (
        <div className="bg-card border border-line rounded-2xl p-5">
          <h2 className="text-xs font-bold text-slate uppercase tracking-wide mb-2">Notes</h2>
          <p className="text-sm">{delivery.customer_remarks}</p>
        </div>
      )}

      <Link href={`/portal/support?delivery=${delivery.id}`} className="text-center py-3 rounded-2xl border border-line text-xs font-bold">Report an issue with this delivery</Link>
    </div>
  );
}
