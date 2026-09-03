import { getCurrentProfile } from "@/lib/session";
import Link from "next/link";
import { pkr, fmtDate } from "@/lib/format";
import { Badge, KPI, ExportExcelButton, PrintButton, Th, Td } from "@/components/ui";
import MarkDeliveredButton from "@/components/MarkDeliveredButton";
import DeliveryStatusButton from "@/components/DeliveryStatusButton";
import BulkImportButton from "@/components/BulkImportButton";
import DeliveryForm from "@/components/DeliveryForm";
import DeliverSheet from "@/components/DeliverSheet";
import OneTapDeliverButton, { SkipDeliveryButton } from "@/components/OneTapDeliverButton";
import ReasonConfirmButton from "@/components/ReasonConfirmButton";
import { bulkImportDeliveries, voidDelivery } from "@/app/actions";
import { Phone, MessageCircle } from "lucide-react";

export const dynamic = "force-dynamic";
function todayISO() { return new Date().toISOString().slice(0, 10); }
const STATUS_TONE = (s) => (s === "delivered" ? "green" : s === "cancelled" || s === "missed" || s === "void" ? "coral" : "amber");
const CARD_STATUS = { delivered: { text: "Completed", tone: "green" }, missed: { text: "Skipped", tone: "coral" }, cancelled: { text: "Skipped", tone: "coral" }, pending: { text: "Pending", tone: "amber" }, rescheduled: { text: "Pending", tone: "amber" } };

// Most recent price row whose validity window covers today — same rule
// getEffectiveRate uses server-side per customer, just computed once here
// over every customer's default product instead of N one-off queries.
function latestValidPrice(rows, today) {
  return (rows || [])
    .filter((r) => r.effective_from <= today && (!r.effective_to || r.effective_to >= today))
    .sort((a, b) => b.effective_from.localeCompare(a.effective_from))[0];
}

// A customer with no preferred_days configured is treated as due every
// day — most customers imported before Phase 1's schedule fields existed
// have no preferred_days at all, and hiding them from Today's Deliveries
// would be a regression, not an improvement.
function isDueToday(c, todayAbbr) {
  if (c.delivery_frequency === "daily") return true;
  if (!c.preferred_days || c.preferred_days.length === 0) return true;
  return c.preferred_days.includes(todayAbbr);
}

export default async function DeliveriesPage({ searchParams }) {
  const sp = (await searchParams) || {};
  const { supabase, user, profile } = await getCurrentProfile();

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

  const today = todayISO();
  const [
    { data: deliveries }, { data: todayDeliveries }, { data: lastDeliveredRaw },
    { data: customersRaw }, { data: zones }, { data: routes }, { data: products },
    { data: balances }, { data: bottleBalances }, { data: customerPrices }, { data: productPrices }, { data: riders },
    { data: canVoidDeliveries },
  ] = await Promise.all([
    supabase.from("deliveries")
      .select("*, customers(name, zone_id), profiles!deliveries_rider_id_fkey(id, full_name), delivery_items(expected_qty)")
      .order("delivery_date", { ascending: false }).limit(200),
    supabase.from("deliveries")
      .select("id, customer_id, status, amount, amount_collected, rider_remarks, profiles!deliveries_rider_id_fkey(full_name), delivery_items(delivered_qty)")
      .eq("delivery_date", today),
    supabase.from("deliveries")
      .select("customer_id, delivery_date, amount_collected, delivery_items(delivered_qty, returned_qty)")
      .eq("status", "delivered").order("delivery_date", { ascending: false }).limit(500),
    supabase.from("customers")
      .select("id, code, name, mobile, route, route_id, routes(name), zone_id, zones(name), default_product_id, payment_frequency, regular_qty, preferred_days, delivery_frequency, status, is_active"),
    supabase.from("zones").select("*"),
    supabase.from("routes").select("id, name").eq("is_active", true).order("name"),
    supabase.from("products").select("id, name").eq("is_active", true).order("name"),
    supabase.from("v_customer_balance").select("customer_id, balance"),
    supabase.from("v_customer_bottle_balance").select("customer_id, bottles_with_customer"),
    supabase.from("customer_prices").select("customer_id, product_id, price, effective_from, effective_to"),
    supabase.from("product_prices").select("product_id, price, effective_from, effective_to"),
    supabase.from("profiles").select("id, full_name, roles!inner(key)").eq("roles.key", "rider").eq("is_active", true).order("full_name"),
    supabase.rpc("fn_has_permission", { perm_key: "deliveries.delete" }),
  ]);

  const qtyOf = (d) => (d.delivery_items || []).reduce((a, i) => a + Number(i.expected_qty), 0);

  const balanceMap = {};
  (balances || []).forEach((b) => { balanceMap[b.customer_id] = Number(b.balance); });
  const bottleBalanceMap = {};
  (bottleBalances || []).forEach((b) => { bottleBalanceMap[b.customer_id] = (bottleBalanceMap[b.customer_id] || 0) + Number(b.bottles_with_customer); });
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

  // TODAY'S DELIVERIES — customers due today, one status per customer.
  const todayAbbr = new Date().toLocaleDateString("en-US", { weekday: "short" });
  const todayStatusMap = {};
  (todayDeliveries || []).forEach((d) => {
    // A customer can only be on one card; if more than one row exists for
    // today, the "most decided" one wins (delivered > missed/cancelled > pending).
    const rank = { delivered: 3, missed: 2, cancelled: 2, pending: 1, rescheduled: 1 };
    const existing = todayStatusMap[d.customer_id];
    if (!existing || (rank[d.status] || 0) >= (rank[existing.status] || 0)) todayStatusMap[d.customer_id] = d;
  });
  const lastDeliveryMap = {};
  (lastDeliveredRaw || []).forEach((d) => {
    if (lastDeliveryMap[d.customer_id]) return;
    const items = d.delivery_items || [];
    lastDeliveryMap[d.customer_id] = {
      deliveredQty: items.reduce((a, i) => a + Number(i.delivered_qty), 0),
      returnedQty: items.reduce((a, i) => a + Number(i.returned_qty), 0),
      cashCollected: Number(d.amount_collected) || 0,
    };
  });

  const zoneFilter = sp.zone || "";
  const routeFilter = sp.route || "";
  const riderFilter = sp.rider || "";
  const q = (sp.q || "").trim().toLowerCase();

  const activeCustomers = (customersRaw || []).filter((c) => c.is_active !== false && c.status !== "inactive" && c.status !== "blacklisted");
  const todayCustomersAll = activeCustomers.filter((c) => isDueToday(c, todayAbbr));
  const todayCustomers = todayCustomersAll.filter((c) => {
    if (zoneFilter && c.zone_id !== zoneFilter) return false;
    if (routeFilter && c.route_id !== routeFilter) return false;
    if (riderFilter && c.assigned_rider_id !== riderFilter) return false;
    if (q) {
      const haystack = [c.code, c.name, c.mobile, c.zones?.name, c.routes?.name || c.route].filter(Boolean).join(" ").toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  }).map((c) => {
    const todayRow = todayStatusMap[c.id];
    const status = CARD_STATUS[todayRow?.status] || CARD_STATUS.pending;
    return {
      id: c.id, code: c.code, name: c.name, zoneName: c.zones?.name, routeName: c.routes?.name || c.route,
      rate: rateMap[c.id] || 0, regularQty: Number(c.regular_qty) || 0, defaultProductId: c.default_product_id,
      bottleBalance: bottleBalanceMap[c.id] || 0, outstanding: balanceMap[c.id] || 0,
      status, deliveredToday: todayRow, lastDelivery: lastDeliveryMap[c.id],
    };
  });

  // KPI ROW
  const bottlesDeliveredToday = (todayDeliveries || []).filter((d) => d.status === "delivered")
    .reduce((a, d) => a + (d.delivery_items || []).reduce((s, i) => s + Number(i.delivered_qty), 0), 0);
  const salesToday = (todayDeliveries || []).filter((d) => d.status === "delivered").reduce((a, d) => a + Number(d.amount), 0);
  const cashCollectedToday = (todayDeliveries || []).reduce((a, d) => a + Number(d.amount_collected || 0), 0);
  const pendingToday = todayCustomers.filter((c) => c.status.text === "Pending").length;

  // ALL DELIVERIES (history) — unchanged filterable table, kept below the
  // new Today's Deliveries workspace so nothing that worked before is lost.
  const statusFilter = sp.status || "";
  const fromDate = sp.from || "";
  const toDate = sp.to || "";
  const historyRider = sp.hrider || "";
  const allRows = (deliveries || []);
  const historyRows = allRows.filter((d) => {
    if (statusFilter && d.status !== statusFilter) return false;
    if (historyRider && d.rider_id !== historyRider) return false;
    if (fromDate && d.delivery_date < fromDate) return false;
    if (toDate && d.delivery_date > toDate) return false;
    return true;
  });
  const exportRows = historyRows.map((d) => ({ Date: d.delivery_date, Customer: d.customers?.name, Qty: qtyOf(d), DeliveryBoy: d.profiles?.full_name, Status: d.status, CashCollected: d.amount_collected }));
  const hasHistoryFilters = statusFilter || historyRider || fromDate || toDate;
  const hasTodayFilters = zoneFilter || routeFilter || riderFilter || q;

  return (
    <div>
      <h2 className="font-display text-2xl font-semibold mb-1">Today&apos;s Deliveries</h2>
      <p className="text-slate text-sm mb-4">{fmtDate(today)} · {todayAbbr}</p>

      <div className="flex flex-wrap gap-3.5 mb-5">
        <KPI label="CUSTOMERS TODAY" value={todayCustomers.length} tone="navy" />
        <KPI label="BOTTLES DELIVERED" value={bottlesDeliveredToday} tone="aqua" />
        <KPI label="SALES" value={pkr(salesToday)} tone="navy" />
        <KPI label="CASH COLLECTED" value={pkr(cashCollectedToday)} tone="green" />
        <KPI label="PENDING" value={pendingToday} tone={pendingToday > 0 ? "amber" : "slate"} />
      </div>

      <form className="no-print flex flex-wrap gap-2.5 mb-4 items-center" action="/deliveries">
        <input type="text" name="q" defaultValue={sp.q || ""} placeholder="Search customer, ID, phone…" className="px-3 py-2 rounded-xl border border-line bg-card text-xs w-52" />
        <select name="zone" defaultValue={zoneFilter} className="px-3 py-2 rounded-xl border border-line bg-card text-xs">
          <option value="">All zones</option>
          {(zones || []).map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
        </select>
        <select name="route" defaultValue={routeFilter} className="px-3 py-2 rounded-xl border border-line bg-card text-xs">
          <option value="">All routes</option>
          {(routes || []).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
        <select name="rider" defaultValue={riderFilter} className="px-3 py-2 rounded-xl border border-line bg-card text-xs">
          <option value="">All delivery boys</option>
          {(riders || []).map((r) => <option key={r.id} value={r.id}>{r.full_name}</option>)}
        </select>
        <button type="submit" className="px-3.5 py-2 rounded-xl border border-line bg-card text-xs font-semibold">Filter</button>
        {hasTodayFilters && <Link href="/deliveries" className="text-xs text-slate hover:text-aqua">Clear</Link>}
      </form>
      {/* Sibling <div>, not inside the filter <form> above — DeliveryForm's
          trigger button has no type="button" set, so nesting it in a form
          makes clicking "New Delivery" also submit that form (same bug
          class fixed on /customers). */}
      <div className="no-print flex flex-wrap gap-2.5 mb-4 items-center">
        <div className="flex-1" />
        <DeliveryForm customers={formCustomers} products={products || []} riders={riders || []} currentUserId={user.id} initialCustomerId={sp.customer || ""} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 mb-8">
        {todayCustomers.length === 0 && <p className="text-sm text-slate col-span-full text-center py-8 border border-line rounded-2xl">No customers due today match these filters.</p>}
        {todayCustomers.map((c) => (
          <div key={c.id} className="card-lift border border-line rounded-2xl p-4 bg-card flex flex-col gap-2.5">
            <div className="flex justify-between items-start gap-2">
              <div className="min-w-0">
                <Link href={`/customers/${c.id}`} className="font-semibold text-navy hover:text-aqua truncate block">{c.name}</Link>
                <p className="text-[11px] text-slate font-mono-num">{c.code || "—"}</p>
              </div>
              <Badge text={c.status.text} tone={c.status.tone} />
            </div>
            <p className="text-[11.5px] text-slate">{c.zoneName || "No zone"}{c.routeName ? ` · ${c.routeName}` : ""}</p>
            <div className="flex justify-between text-[12.5px]">
              <span>{c.regularQty || "—"} × {pkr(c.rate)}</span>
              <span className="font-mono-num font-semibold">{c.regularQty ? pkr(c.regularQty * c.rate) : "—"}</span>
            </div>
            <div className="flex justify-between text-[11.5px] text-slate">
              <span>Bottle balance: <strong className="text-ink">{c.bottleBalance}</strong></span>
              <span className={c.outstanding > 0 ? "text-coral font-semibold" : "text-green font-semibold"}>{pkr(c.outstanding)}</span>
            </div>
            {c.status.text === "Pending" ? (
              <div className="flex flex-wrap gap-1.5 mt-1">
                <DeliverSheet customer={c} riders={riders || []} currentUserId={user.id} />
                {c.lastDelivery && (
                  <OneTapDeliverButton
                    variant="repeat" label="Repeat Last" customer={c} currentUserId={user.id}
                    deliveredQty={c.lastDelivery.deliveredQty} returnedQty={c.lastDelivery.returnedQty} cashCollected={c.lastDelivery.cashCollected}
                  />
                )}
                {!c.lastDelivery && c.regularQty > 0 && (
                  <OneTapDeliverButton
                    variant="complete" label="Complete" customer={c} currentUserId={user.id}
                    deliveredQty={c.regularQty} returnedQty={c.regularQty} cashCollected={Math.round(c.regularQty * c.rate)}
                  />
                )}
                <SkipDeliveryButton customerId={c.id} />
              </div>
            ) : (
              <p className="text-[11.5px] text-slate mt-1">
                {c.status.text === "Completed"
                  ? `Delivered${c.deliveredToday?.profiles?.full_name ? ` by ${c.deliveredToday.profiles.full_name}` : ""} · Collected ${pkr(c.deliveredToday?.amount_collected || 0)}`
                  : (c.deliveredToday?.rider_remarks || "Skipped today")}
              </p>
            )}
          </div>
        ))}
      </div>

      <details className="mb-4">
        <summary className="no-print cursor-pointer font-display text-base font-semibold mb-3">Delivery History</summary>
        <div className="mt-3">
          <form className="no-print flex flex-wrap gap-2.5 mb-2 items-center" action="/deliveries">
            <select name="hrider" defaultValue={historyRider} className="px-3 py-2 rounded-xl border border-line bg-card text-xs">
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
              <option value="void">Voided</option>
            </select>
            <input type="date" name="from" defaultValue={fromDate} className="px-3 py-2 rounded-xl border border-line bg-card text-xs" />
            <input type="date" name="to" defaultValue={toDate} className="px-3 py-2 rounded-xl border border-line bg-card text-xs" />
            <button type="submit" className="px-3.5 py-2 rounded-xl border border-line bg-card text-xs font-semibold">Filter</button>
            {hasHistoryFilters && <Link href="/deliveries" className="text-xs text-slate hover:text-aqua">Clear</Link>}
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
          </form>
          <p className="no-print text-xs text-slate mb-2">{historyRows.length} of {allRows.length} deliveries</p>
          <div className="overflow-x-auto border border-line rounded-2xl">
            <table className="w-full text-[13.5px] border-collapse">
              <thead><tr className="bg-foam"><Th>Date</Th><Th>Customer</Th><Th>Qty</Th><Th>Delivery Boy</Th><Th>Status</Th><Th>Cash Collected</Th><Th>Notes</Th><Th className="no-print">&nbsp;</Th></tr></thead>
              <tbody>
                {historyRows.length === 0 && <tr><td colSpan={8} className="text-center py-8 text-slate">No deliveries match.</td></tr>}
                {historyRows.map((d) => (
                  <tr key={d.id} className={`hover:bg-foam ${d.status === "void" ? "opacity-60" : ""}`}>
                    <Td>{fmtDate(d.delivery_date)}</Td><Td>{d.customers?.name}</Td><Td>{qtyOf(d)}</Td><Td>{d.profiles?.full_name || "—"}</Td>
                    <Td><Badge text={d.status} tone={STATUS_TONE(d.status)} />{d.status === "void" && d.void_reason && <div className="text-[10px] text-slate mt-1 max-w-[140px]">{d.void_reason}</div>}</Td>
                    <Td>{pkr(d.amount_collected)}</Td><Td className="max-w-[220px] truncate">{d.rider_remarks || "—"}</Td>
                    <Td className="no-print">
                      {canVoidDeliveries && d.status !== "void" && (
                        <ReasonConfirmButton action={voidDelivery} id={d.id} label="Void"
                          confirmText={`Void this delivery for ${d.customers?.name}?`}
                          detailText="This can't be undone. Reverses the bottle movement, the ledger charge, and any payment collected on this delivery."
                          confirmLabel="Confirm Void" busyLabel="Voiding…" />
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </details>
    </div>
  );
}
