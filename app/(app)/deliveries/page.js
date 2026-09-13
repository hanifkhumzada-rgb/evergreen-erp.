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
import WhatsAppButton from "@/components/WhatsAppButton";
import { bulkImportDeliveries, voidDelivery } from "@/app/actions";
import { getBrandingLite } from "@/lib/pdf/business";
import DocumentPrintHeader, { DocumentPrintFooter } from "@/components/DocumentPrintHeader";
import { Phone, MessageCircle, Search } from "lucide-react";

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
  const historyMonth = /^\d{4}-\d{2}$/.test(sp.month || "") ? sp.month : today.slice(0, 7);
  const historyFrom = `${historyMonth}-01`;
  const historyUntilDate = new Date(`${historyFrom}T00:00:00Z`);
  historyUntilDate.setUTCMonth(historyUntilDate.getUTCMonth() + 1);
  const historyUntil = historyUntilDate.toISOString().slice(0, 10);
  const [
    branding,
    { data: deliveries }, { data: todayDeliveries }, { data: lastDeliveredRaw },
    { data: customersRaw }, { data: zones }, { data: routes }, { data: products },
    { data: balances }, { data: bottleBalances }, { data: customerPrices }, { data: productPrices }, { data: riders },
    { data: canVoidDeliveries },
  ] = await Promise.all([
    getBrandingLite(supabase),
    supabase.from("deliveries")
      .select("*, customers(name, code, mobile, zone_id), profiles!deliveries_rider_id_fkey(id, full_name), delivery_items(expected_qty, delivered_qty, returned_qty)")
      .gte("delivery_date", historyFrom).lt("delivery_date", historyUntil)
      .order("delivery_date", { ascending: false }).limit(5000),
    supabase.from("deliveries")
      .select("id, customer_id, status, amount, amount_collected, rider_remarks, profiles!deliveries_rider_id_fkey(full_name), delivery_items(delivered_qty)")
      .eq("delivery_date", today),
    supabase.from("deliveries")
      .select("customer_id, delivery_date, amount_collected, delivery_items(delivered_qty, returned_qty)")
      .eq("status", "delivered").order("delivery_date", { ascending: false }).limit(500),
    supabase.from("customers")
      .select("id, code, name, mobile, route, route_id, routes(name), zone_id, zones(name), default_product_id, payment_frequency, payment_terms, regular_qty, preferred_days, delivery_frequency, assigned_rider_id, status, is_active"),
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

  const qtyOf = (d) => (d.delivery_items || []).reduce((a, i) => a + Number(i.delivered_qty ?? i.expected_qty), 0);

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
      id: c.id, code: c.code, name: c.name, mobile: c.mobile, zoneName: c.zones?.name, routeName: c.routes?.name || c.route,
      rate: rateMap[c.id] || 0, regularQty: Number(c.regular_qty) || 0, defaultProductId: c.default_product_id,
      bottleBalance: bottleBalanceMap[c.id] || 0, outstanding: balanceMap[c.id] || 0,
      paymentFrequency: c.payment_frequency || "Monthly",
      collectOnDelivery: c.payment_frequency === "Daily" || /cash\s*on\s*delivery|\bcash\b/i.test(c.payment_terms || ""),
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
  const historyQuery = (sp.hq || "").trim().toLowerCase();
  const allRows = (deliveries || []);
  const historyRows = allRows.filter((d) => {
    if (historyQuery && !`${d.customers?.name || ""} ${d.customers?.code || ""} ${d.customers?.mobile || ""}`.toLowerCase().includes(historyQuery)) return false;
    if (statusFilter && d.status !== statusFilter) return false;
    if (historyRider && d.rider_id !== historyRider) return false;
    if (fromDate && d.delivery_date < fromDate) return false;
    if (toDate && d.delivery_date > toDate) return false;
    return true;
  });
  const historySort = sp.sort || "name";
  const monthlyCustomerRows = Object.values(historyRows.filter((d) => d.status === "delivered").reduce((acc, d) => {
    const id = d.customer_id;
    const row = acc[id] || { id, code: d.customers?.code || "—", name: d.customers?.name || "Unknown", visits: 0, qty: 0, returned: 0, amount: 0, collected: 0, first: d.delivery_date, latest: d.delivery_date };
    row.visits += 1;
    row.qty += qtyOf(d);
    row.returned += (d.delivery_items || []).reduce((sum, item) => sum + Number(item.returned_qty || 0), 0);
    row.amount += Number(d.amount || 0);
    row.collected += Number(d.amount_collected || 0);
    if (d.delivery_date < row.first) row.first = d.delivery_date;
    if (d.delivery_date > row.latest) row.latest = d.delivery_date;
    acc[id] = row;
    return acc;
  }, {})).sort((a, b) => {
    if (historySort === "code") return a.code.localeCompare(b.code, undefined, { numeric: true });
    if (historySort === "qty") return b.qty - a.qty;
    if (historySort === "latest") return b.latest.localeCompare(a.latest);
    return a.name.localeCompare(b.name);
  });
  const exportRows = historyRows.map((d) => ({ Date: d.delivery_date, Customer: d.customers?.name, Qty: qtyOf(d), DeliveryBoy: d.profiles?.full_name, Status: d.status, CashCollected: d.amount_collected }));
  const hasHistoryFilters = statusFilter || historyRider || fromDate || toDate;
  const hasTodayFilters = zoneFilter || routeFilter || riderFilter || q;

  return (
    <div>
      <DocumentPrintHeader branding={branding} title="Today's Deliveries" meta={`${todayCustomers.length} customers due today\n${historyRows.length} of ${allRows.length} in history\nGenerated ${fmtDate(today)}`} />
      <div className="no-print flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
        <div>
          <h2 className="font-display text-2xl font-semibold mb-1">Today&apos;s Deliveries</h2>
          <p className="text-slate text-sm">{fmtDate(today)} · {todayAbbr}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <BulkImportButton
            label="Bulk Delivery Import"
            columnsHint="Phone (or Name), Qty, CashCollected, Date, Product (optional), Returned (optional)"
            action={bulkImportDeliveries}
            sampleRow={{ Phone: "03001234567", Name: "Ali Traders", Qty: 5, CashCollected: 600, Date: "2026-08-31", Product: "19L", Returned: 5 }}
            previewType="deliveries"
          />
          <DeliveryForm customers={formCustomers} products={products || []} riders={riders || []} currentUserId={user.id} initialCustomerId={sp.customer || ""} initialOpen={sp.quick === "new"} />
        </div>
      </div>

      <div className="no-print flex flex-wrap gap-3.5 mb-5">
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
        <button type="submit" className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-line bg-card text-xs font-semibold"><Search size={14} /> Search</button>
        {hasTodayFilters && <Link href="/deliveries" className="text-xs text-slate hover:text-aqua">Clear</Link>}
      </form>
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
                    deliveredQty={c.lastDelivery.deliveredQty} returnedQty={c.lastDelivery.returnedQty}
                    cashCollected={c.collectOnDelivery ? Math.round(c.lastDelivery.deliveredQty * c.rate) : 0}
                  />
                )}
                {!c.lastDelivery && c.regularQty > 0 && (
                  <OneTapDeliverButton
                    variant="complete" label="Complete" customer={c} currentUserId={user.id}
                    deliveredQty={c.regularQty} returnedQty={c.regularQty} cashCollected={c.collectOnDelivery ? Math.round(c.regularQty * c.rate) : 0}
                  />
                )}
                <SkipDeliveryButton customerId={c.id} />
                <WhatsAppButton phone={c.mobile} label="Notify"
                  message={`Hi ${c.name}, your Evergreen Water delivery is scheduled for today. We'll be with you shortly!`} />
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

      <section className="mb-4">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2"><div><h3 className="font-display text-lg font-semibold">Delivery History</h3><p className="text-xs text-slate">Har delivery apni original date aur quantity ke saath separate record hai.</p></div><Badge text={historyMonth} tone="aqua" /></div>
        <div>
          <form className="erp-toolbar no-print flex flex-wrap gap-2.5 mb-3 items-center" action="/deliveries">
            <input type="search" name="hq" defaultValue={sp.hq || ""} placeholder="Search history by customer…" className="px-3 py-2 rounded-xl border border-line bg-card text-xs w-56" />
            <input type="month" name="month" defaultValue={historyMonth} className="px-3 py-2 rounded-xl border border-line bg-card text-xs" />
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
            <select name="sort" defaultValue={historySort} className="px-3 py-2 rounded-xl border border-line bg-card text-xs">
              <option value="name">Sort: Customer name</option><option value="code">Sort: Customer ID</option><option value="qty">Sort: Highest quantity</option><option value="latest">Sort: Latest delivery</option>
            </select>
            <input type="date" name="from" defaultValue={fromDate} className="px-3 py-2 rounded-xl border border-line bg-card text-xs" />
            <input type="date" name="to" defaultValue={toDate} className="px-3 py-2 rounded-xl border border-line bg-card text-xs" />
            <button type="submit" className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-line bg-card text-xs font-semibold"><Search size={14} /> Search</button>
            {(hasHistoryFilters || historyQuery || sp.month) && <Link href="/deliveries" className="text-xs text-slate hover:text-aqua">Clear</Link>}
            <div className="flex-1" />
            <ExportExcelButton rows={exportRows} sheetName="Deliveries" reportTitle="Deliveries" branding={branding} />
            <PrintButton />
          </form>
          <p className="no-print text-xs text-slate mb-2">{historyRows.length} of {allRows.length} deliveries</p>
          <div className="mb-4 overflow-x-auto rounded-2xl border border-line bg-card">
            <div className="flex items-center justify-between gap-3 border-b border-line bg-gradient-to-r from-aquaSoft to-card px-4 py-3"><div><h4 className="text-sm font-bold">Customer Monthly Totals</h4><p className="text-[11px] text-slate">Old records remain separate; totals automatically include every delivery in {historyMonth}.</p></div><Badge text={`${monthlyCustomerRows.length} customers`} tone="green" /></div>
            <table className="w-full min-w-[780px] text-[13px] border-collapse">
              <thead><tr className="bg-foam"><Th>#</Th><Th>Customer ID</Th><Th>Customer</Th><Th>Visits</Th><Th>Total Qty</Th><Th>Returned</Th><Th>Sales</Th><Th>Collected</Th><Th>First / Latest</Th></tr></thead>
              <tbody>{monthlyCustomerRows.length === 0 ? <tr><td colSpan={9} className="py-7 text-center text-slate">No completed deliveries in this selection.</td></tr> : monthlyCustomerRows.map((row, index) => <tr key={row.id} className="hover:bg-aquaSoft/40"><Td>{index + 1}</Td><Td>{row.code}</Td><Td>{row.name}</Td><Td>{row.visits}</Td><Td><strong>{row.qty}</strong></Td><Td>{row.returned}</Td><Td>{pkr(row.amount)}</Td><Td>{pkr(row.collected)}</Td><Td>{fmtDate(row.first)} · {fmtDate(row.latest)}</Td></tr>)}</tbody>
            </table>
          </div>
          <div className="overflow-x-auto border border-line rounded-2xl">
            <table className="w-full text-[13.5px] border-collapse">
              <thead><tr className="bg-foam"><Th>#</Th><Th>Date</Th><Th>Customer</Th><Th>Qty</Th><Th>Delivery Boy</Th><Th>Status</Th><Th>Cash Collected</Th><Th>Notes</Th><Th className="no-print">&nbsp;</Th></tr></thead>
              <tbody>
                {historyRows.length === 0 && <tr><td colSpan={9} className="text-center py-8 text-slate">No deliveries match.</td></tr>}
                {historyRows.map((d, index) => (
                  <tr key={d.id} className={`hover:bg-foam ${d.status === "void" ? "opacity-60" : ""}`}>
                    <Td>{index + 1}</Td><Td>{fmtDate(d.delivery_date)}</Td><Td>{d.customers?.name}</Td><Td>{qtyOf(d)}</Td><Td>{d.profiles?.full_name || "—"}</Td>
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
      </section>
      <DocumentPrintFooter />
    </div>
  );
}
