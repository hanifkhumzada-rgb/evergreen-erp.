import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { pkr, fmtDate } from "@/lib/format";
import { Badge, ExportExcelButton, PrintButton, Th, Td } from "@/components/ui";
import MarkDeliveredButton from "@/components/MarkDeliveredButton";
import DeliveryStatusButton from "@/components/DeliveryStatusButton";
import BulkImportButton from "@/components/BulkImportButton";
import DeliveryForm from "@/components/DeliveryForm";
import { bulkImportDeliveries } from "@/app/actions";
import { Phone, MessageCircle } from "lucide-react";

export const dynamic = "force-dynamic";
function todayISO() { return new Date().toISOString().slice(0, 10); }
const STATUS_TONE = (s) => (s === "delivered" ? "green" : s === "cancelled" || s === "missed" ? "coral" : "amber");

// Most recent price row whose validity window covers today — same rule
// getEffectiveRate uses server-side per customer, just computed once here
// over every customer's default product instead of N one-off queries.
function latestValidPrice(rows, today) {
  return (rows || [])
    .filter((r) => r.effective_from <= today && (!r.effective_to || r.effective_to >= today))
    .sort((a, b) => b.effective_from.localeCompare(a.effective_from))[0];
}

export default async function DeliveriesPage({ searchParams }) {
  const sp = (await searchParams) || {};
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("profiles").select("*, roles(key)").eq("id", user.id).single();

  if (profile?.roles?.key === "rider") {
    const { data: deliveries } = await supabase.from("deliveries")
      .select("*, customers(*), delivery_items(expected_qty)")
      .eq("rider_id", user.id).eq("delivery_date", todayISO());

    return (
      <div>
        <h2 className="font-display text-2xl font-semibold mb-4">Today&apos;s Route</h2>
        <div className="flex flex-col gap-3">
          {(deliveries || []).length === 0 && <p className="text-sm text-slate">No deliveries assigned for today.</p>}
          {(deliveries || []).map((d) => {
            const qty = (d.delivery_items || []).reduce((a, i) => a + Number(i.expected_qty), 0);
            return (
              <div key={d.id} className="border border-line rounded-2xl p-4">
                <div className="flex justify-between"><strong>{d.customers?.name}</strong><Badge text={d.status} tone={STATUS_TONE(d.status)} /></div>
                <p className="text-xs text-slate my-1">{d.customers?.address}</p>
                <p className="text-sm">Qty: <strong>{qty}</strong> · Empty expected: <strong>{qty}</strong></p>
                <div className="flex gap-2 mt-2.5 flex-wrap">
                  <a href={`tel:${d.customers?.mobile}`} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-line bg-card text-xs font-semibold"><Phone size={14} /> Call</a>
                  {d.customers?.whatsapp_number && <a href={`https://wa.me/${d.customers.whatsapp_number.replace(/^0/, "92")}`} target="_blank" className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-line bg-card text-xs font-semibold"><MessageCircle size={14} /> WhatsApp</a>}
                  {d.status !== "delivered" && (
                    <>
                      <MarkDeliveredButton deliveryId={d.id} emptyExpected={qty} />
                      <DeliveryStatusButton deliveryId={d.id} status="missed" label="Failed" tone="coral" />
                      <DeliveryStatusButton deliveryId={d.id} status="rescheduled" label="Reschedule" tone="amber" />
                      <DeliveryStatusButton deliveryId={d.id} status="cancelled" label="Cancel" tone="coral" />
                    </>
                  )}
                </div>
                {d.rider_remarks && <p className="text-xs text-slate mt-2 italic">Note: {d.rider_remarks}</p>}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  const [
    { data: deliveries }, { data: customersRaw }, { data: zones }, { data: products },
    { data: balances }, { data: bottleBalances }, { data: customerPrices }, { data: productPrices }, { data: riders },
  ] = await Promise.all([
    supabase.from("deliveries")
      .select("*, customers(name, zone_id), profiles!deliveries_rider_id_fkey(id, full_name), delivery_items(expected_qty)")
      .order("delivery_date", { ascending: false }).limit(200),
    supabase.from("customers").select("id, code, name, mobile, route, zone_id, zones(name), default_product_id, payment_frequency"),
    supabase.from("zones").select("*"),
    supabase.from("products").select("id, name").eq("is_active", true).order("name"),
    supabase.from("v_customer_balance").select("customer_id, balance"),
    supabase.from("v_customer_bottle_balance").select("customer_id, bottles_with_customer"),
    supabase.from("customer_prices").select("customer_id, product_id, price, effective_from, effective_to"),
    supabase.from("product_prices").select("product_id, price, effective_from, effective_to"),
    supabase.from("profiles").select("id, full_name, roles!inner(key)").eq("roles.key", "rider").eq("is_active", true).order("full_name"),
  ]);

  const qtyOf = (d) => (d.delivery_items || []).reduce((a, i) => a + Number(i.expected_qty), 0);

  const balanceMap = {};
  (balances || []).forEach((b) => { balanceMap[b.customer_id] = Number(b.balance); });
  const bottleBalanceMap = {};
  (bottleBalances || []).forEach((b) => { bottleBalanceMap[b.customer_id] = (bottleBalanceMap[b.customer_id] || 0) + Number(b.bottles_with_customer); });
  const today = todayISO();
  const rateMap = {};
  (customersRaw || []).forEach((c) => {
    if (!c.default_product_id) return;
    const custPrice = latestValidPrice((customerPrices || []).filter((p) => p.customer_id === c.id && p.product_id === c.default_product_id), today);
    if (custPrice) { rateMap[c.id] = Number(custPrice.price); return; }
    const prodPrice = latestValidPrice((productPrices || []).filter((p) => p.product_id === c.default_product_id), today);
    if (prodPrice) rateMap[c.id] = Number(prodPrice.price);
  });
  const formCustomers = (customersRaw || []).map((c) => ({
    id: c.id, code: c.code, name: c.name, mobile: c.mobile, route: c.route,
    zoneName: c.zones?.name, default_product_id: c.default_product_id, payment_frequency: c.payment_frequency,
    balance: balanceMap[c.id] || 0, bottleBalance: bottleBalanceMap[c.id] || 0, rate: rateMap[c.id] || 0,
  }));

  // Filters — server-rendered via searchParams, same pattern as /customers.
  const zoneFilter = sp.zone || "";
  const statusFilter = sp.status || "";
  const riderFilter = sp.rider || "";
  const fromDate = sp.from || "";
  const toDate = sp.to || "";
  const q = (sp.q || "").trim().toLowerCase();

  const allRows = (deliveries || []);
  const rows = allRows.filter((d) => {
    if (zoneFilter && d.customers?.zone_id !== zoneFilter) return false;
    if (statusFilter && d.status !== statusFilter) return false;
    if (riderFilter && d.rider_id !== riderFilter) return false;
    if (fromDate && d.delivery_date < fromDate) return false;
    if (toDate && d.delivery_date > toDate) return false;
    if (q && !(d.customers?.name || "").toLowerCase().includes(q)) return false;
    return true;
  });

  const exportRows = rows.map((d) => ({ Date: d.delivery_date, Customer: d.customers?.name, Qty: qtyOf(d), DeliveryBoy: d.profiles?.full_name, Status: d.status, CashCollected: d.amount_collected }));
  const hasFilters = zoneFilter || statusFilter || riderFilter || fromDate || toDate || q;

  return (
    <div>
      <h2 className="font-display text-2xl font-semibold mb-4">Deliveries</h2>
      <form className="no-print flex flex-wrap gap-2.5 mb-2 items-center" action="/deliveries">
        <input type="text" name="q" defaultValue={sp.q || ""} placeholder="Search customer…" className="px-3 py-2 rounded-xl border border-line bg-card text-xs w-40" />
        <select name="zone" defaultValue={zoneFilter} className="px-3 py-2 rounded-xl border border-line bg-card text-xs">
          <option value="">All zones</option>
          {(zones || []).map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
        </select>
        <select name="rider" defaultValue={riderFilter} className="px-3 py-2 rounded-xl border border-line bg-card text-xs">
          <option value="">All delivery boys</option>
          {(riders || []).map((r) => <option key={r.id} value={r.id}>{r.full_name}</option>)}
        </select>
        <select name="status" defaultValue={statusFilter} className="px-3 py-2 rounded-xl border border-line bg-card text-xs">
          <option value="">All statuses</option>
          <option value="delivered">Delivered</option>
          <option value="pending">Pending</option>
          <option value="missed">Missed</option>
          <option value="rescheduled">Rescheduled</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <input type="date" name="from" defaultValue={fromDate} className="px-3 py-2 rounded-xl border border-line bg-card text-xs" />
        <input type="date" name="to" defaultValue={toDate} className="px-3 py-2 rounded-xl border border-line bg-card text-xs" />
        <button type="submit" className="px-3.5 py-2 rounded-xl border border-line bg-card text-xs font-semibold">Filter</button>
        {hasFilters && <Link href="/deliveries" className="text-xs text-slate hover:text-aqua">Clear</Link>}
      </form>
      <div className="no-print flex flex-wrap gap-2.5 mb-4 items-center">
        <div className="flex-1" />
        <BulkImportButton
          label="Bulk Import"
          columnsHint="Phone (or Name), Qty, CashCollected, Date, Product (optional — size/sku, defaults to 19L), Returned (optional — empties collected, defaults to Qty)"
          action={bulkImportDeliveries}
          sampleRow={{ Phone: "03001234567", Name: "Ali Traders", Qty: 5, CashCollected: 600, Date: "2026-08-31", Product: "19L", Returned: 5 }}
          previewType="deliveries"
        />
        <ExportExcelButton rows={exportRows} filename="evergreen-deliveries.xlsx" sheetName="Deliveries" />
        <PrintButton />
        <DeliveryForm customers={formCustomers} products={products || []} riders={riders || []} currentUserId={user.id} />
      </div>
      <p className="no-print text-xs text-slate mb-2">{rows.length} of {allRows.length} deliveries</p>
      <div className="overflow-x-auto border border-line rounded-2xl">
        <table className="w-full text-[13.5px] border-collapse">
          <thead><tr className="bg-foam"><Th>Date</Th><Th>Customer</Th><Th>Qty</Th><Th>Delivery Boy</Th><Th>Status</Th><Th>Cash Collected</Th><Th>Notes</Th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={7} className="text-center py-8 text-slate">No deliveries match.</td></tr>}
            {rows.map((d) => (
              <tr key={d.id} className="hover:bg-foam"><Td>{fmtDate(d.delivery_date)}</Td><Td>{d.customers?.name}</Td><Td>{qtyOf(d)}</Td><Td>{d.profiles?.full_name || "—"}</Td>
                <Td><Badge text={d.status} tone={STATUS_TONE(d.status)} /></Td><Td>{pkr(d.amount_collected)}</Td><Td className="max-w-[220px] truncate">{d.rider_remarks || "—"}</Td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
