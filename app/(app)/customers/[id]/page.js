import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { pkr, fmtDate } from "@/lib/format";
import { KPI, Badge, Th, Td, PrintButton, DownloadPdfButton } from "@/components/ui";
import CustomerForm, { EditCustomerTrigger } from "@/components/CustomerForm";
import { SalesTrendChart } from "@/components/DashboardCharts";

export const dynamic = "force-dynamic";

const INVOICE_TONE = { paid: "green", partially_paid: "amber", sent: "amber", draft: "slate", overdue: "coral", void: "slate" };
const STATUS_BADGE = {
  active: { text: "Active", tone: "green" },
  inactive: { text: "Inactive", tone: "slate" },
  on_hold: { text: "On Hold", tone: "amber" },
  blacklisted: { text: "Blacklisted", tone: "coral" },
};
const DELIVERY_TONE = (s) => (s === "delivered" ? "green" : s === "cancelled" || s === "missed" ? "coral" : "amber");
const UNPAID_STATUSES = ["sent", "partially_paid", "overdue"];
const AGING_BUCKETS = ["Current", "1-30 days", "31-60 days", "61-90 days", "90+ days"];

function agingBucket(dueDateStr, todayISO) {
  if (!dueDateStr) return "Current";
  const days = Math.floor((new Date(todayISO) - new Date(dueDateStr)) / (1000 * 60 * 60 * 24));
  if (days <= 0) return "Current";
  if (days <= 30) return "1-30 days";
  if (days <= 60) return "31-60 days";
  if (days <= 90) return "61-90 days";
  return "90+ days";
}

function SectionTitle({ children }) {
  return <h3 className="font-display text-base font-semibold mt-7 mb-3 pb-2 border-b border-line">{children}</h3>;
}

export default async function CustomerProfilePage({ params }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const [
    { data: c }, { data: invoices }, { data: payments }, { data: balanceRow }, { data: bottleBalanceRows },
    { data: deliveries }, { data: bottleTxns }, { data: ledgerEntries },
    { data: zones }, { data: products }, { data: vehicles }, { data: riders }, { data: profile },
  ] = await Promise.all([
    supabase.from("customers").select("*, zones(name), profiles!customers_assigned_rider_id_fkey(full_name), vehicles(registration_no)").eq("id", params.id).single(),
    supabase.from("invoices").select("*").eq("customer_id", params.id).order("invoice_date", { ascending: false }),
    supabase.from("payments").select("*").eq("customer_id", params.id).order("payment_date", { ascending: false }),
    supabase.from("v_customer_balance").select("balance").eq("customer_id", params.id).maybeSingle(),
    supabase.from("v_customer_bottle_balance").select("product_id, product_name, bottles_with_customer").eq("customer_id", params.id),
    supabase.from("deliveries").select("*, delivery_items(product_id, delivered_qty, returned_qty, products(name))").eq("customer_id", params.id).order("delivery_date", { ascending: false }),
    supabase.from("bottle_transactions").select("*, products(name)").eq("customer_id", params.id).order("txn_date", { ascending: false }),
    supabase.from("customer_ledger_entries").select("*").eq("customer_id", params.id).order("entry_date", { ascending: false }).limit(30),
    supabase.from("zones").select("*"),
    supabase.from("products").select("id, name").eq("is_active", true).order("name"),
    supabase.from("vehicles").select("id, registration_no").eq("is_active", true).order("registration_no"),
    supabase.from("profiles").select("id, full_name, roles!inner(key)").eq("roles.key", "rider").eq("is_active", true).order("full_name"),
    supabase.from("profiles").select("roles(key)").eq("id", user.id).single(),
  ]);

  if (!c) {
    return (
      <div>
        <Link href="/customers" className="no-print flex items-center gap-2 text-aqua font-semibold text-sm mb-4"><ArrowLeft size={18} /> Back to Customers</Link>
        <p>Customer not found.</p>
      </div>
    );
  }

  const todayISO = new Date().toISOString().slice(0, 10);

  // FINANCIAL
  const totalSales = (invoices || []).reduce((a, s) => a + Number(s.net_amount), 0);
  const totalPaid = (payments || []).reduce((a, p) => a + Number(p.amount), 0);
  const balance = Number(balanceRow?.balance || 0);
  const availableCredit = Number(c.credit_limit) - balance;
  const lastPayment = (payments || [])[0];
  const aging = {};
  AGING_BUCKETS.forEach((b) => { aging[b] = 0; });
  (invoices || []).filter((i) => UNPAID_STATUSES.includes(i.status)).forEach((i) => {
    aging[agingBucket(i.due_date, todayISO)] += Number(i.net_amount);
  });

  // DELIVERY
  const totalDeliveries = (deliveries || []).length;
  const deliveredList = (deliveries || []).filter((d) => d.status === "delivered");
  const lastDelivery = deliveredList[0];
  const nextScheduled = (deliveries || [])
    .filter((d) => d.status === "pending" && d.delivery_date >= todayISO)
    .sort((a, b) => a.delivery_date.localeCompare(b.delivery_date))[0];
  const failedDeliveries = (deliveries || []).filter((d) => d.status === "missed").length;

  // BOTTLES — never mixed across sizes; delivered/returned/damaged/lost per
  // product from the raw movement ledger, current balance from the same
  // view the Bottle Ledger page uses (single source of truth).
  const balanceByProduct = {};
  (bottleBalanceRows || []).forEach((b) => { balanceByProduct[b.product_id] = { name: b.product_name, balance: Number(b.bottles_with_customer) }; });
  const bottleByProduct = {};
  (bottleTxns || []).forEach((t) => {
    const key = t.product_id;
    const row = bottleByProduct[key] || { name: t.products?.name || "—", delivered: 0, returned: 0, damaged: 0, lost: 0 };
    if (t.to_state === "with_customer") row.delivered += Number(t.quantity);
    if (t.from_state === "with_customer" && t.to_state !== "damaged" && t.to_state !== "lost") row.returned += Number(t.quantity);
    if (t.to_state === "damaged") row.damaged += Number(t.quantity);
    if (t.to_state === "lost") row.lost += Number(t.quantity);
    bottleByProduct[key] = row;
  });
  const productIds = Array.from(new Set([...Object.keys(balanceByProduct), ...Object.keys(bottleByProduct)]));
  const bottleRows = productIds.map((pid) => ({
    name: bottleByProduct[pid]?.name || balanceByProduct[pid]?.name || (products || []).find((p) => p.id === pid)?.name || "—",
    delivered: bottleByProduct[pid]?.delivered || 0,
    returned: bottleByProduct[pid]?.returned || 0,
    damaged: bottleByProduct[pid]?.damaged || 0,
    lost: bottleByProduct[pid]?.lost || 0,
    balance: balanceByProduct[pid]?.balance || 0,
  }));
  const totalBottleBalance = bottleRows.reduce((a, r) => a + r.balance, 0);

  // ANALYTICS
  const avgOrder = invoices?.length ? totalSales / invoices.length : 0;
  const monthsSinceJoin = Math.max(1, Math.round((new Date() - new Date(c.registration_date || c.created_at)) / (1000 * 60 * 60 * 24 * 30)));
  const orderFrequency = invoices?.length ? invoices.length / monthsSinceJoin : 0;
  const monthMap = {};
  (invoices || []).forEach((i) => {
    const m = (i.invoice_date || "").slice(0, 7);
    if (!m) return;
    monthMap[m] = (monthMap[m] || 0) + Number(i.net_amount);
  });
  const monthlySales = Object.entries(monthMap).sort(([a], [b]) => a.localeCompare(b)).slice(-6)
    .map(([m, sales]) => ({ day: new Date(m + "-01").toLocaleDateString("en-GB", { month: "short" }), sales }));
  const lastActivity = [invoices?.[0]?.invoice_date, payments?.[0]?.payment_date, deliveredList[0]?.delivery_date].filter(Boolean).sort().reverse()[0];
  const isRecentlyActive = lastActivity && (new Date() - new Date(lastActivity)) / (1000 * 60 * 60 * 24) <= 60;

  const statusBadge = STATUS_BADGE[c.status] || (c.is_active ? STATUS_BADGE.active : STATUS_BADGE.inactive);
  const canManageFinancial = ["owner", "admin"].includes(profile?.roles?.key);

  return (
    <div className="print-area">
      <Link href="/customers" className="no-print flex items-center gap-2 text-aqua font-semibold text-sm mb-4"><ArrowLeft size={18} /> Back to Customers</Link>

      <div className="flex justify-between items-start mb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="font-display text-2xl font-semibold">{c.name}</h2>
            <Badge text={statusBadge.text} tone={statusBadge.tone} />
          </div>
          <p className="text-slate text-sm mt-1">{c.customer_type} · {c.zones?.name || "No zone"} · Customer since {fmtDate(c.created_at)}</p>
        </div>
        <div className="no-print flex gap-2">
          <CustomerForm
            mode="edit" customer={c}
            zones={zones || []} products={products || []} vehicles={vehicles || []} riders={riders || []}
            canManageFinancial={canManageFinancial}
            trigger={<EditCustomerTrigger />}
          />
          <DownloadPdfButton href={`/api/pdf/customer-statement/${c.id}`} label="Download Statement" />
          <PrintButton />
        </div>
      </div>

      {/* CUSTOMER OVERVIEW */}
      <div className="flex gap-x-5 gap-y-1.5 flex-wrap text-[13px] text-slate">
        <span>{c.mobile}</span>
        {c.whatsapp_number && <span>WhatsApp: {c.whatsapp_number}</span>}
        {c.email && <span>{c.email}</span>}
        {c.contact_person && <span>Contact: {c.contact_person}</span>}
        <span>{c.address}{c.area ? `, ${c.area}` : ""}</span>
        {c.route && <span>Route: {c.route}</span>}
        {c.preferred_delivery_time && <span>{c.preferred_delivery_time}</span>}
        {c.profiles?.full_name && <span>Driver: {c.profiles.full_name}</span>}
        {c.vehicles?.registration_no && <span>Vehicle: {c.vehicles.registration_no}</span>}
        {c.payment_terms && <span>Terms: {c.payment_terms}</span>}
      </div>
      {c.delivery_instructions && <p className="text-[13px] text-slate mt-2"><span className="font-semibold">Delivery instructions:</span> {c.delivery_instructions}</p>}
      {c.notes && <p className="text-[13px] text-slate mt-1"><span className="font-semibold">Notes:</span> {c.notes}</p>}

      {/* FINANCIAL */}
      <SectionTitle>Financial</SectionTitle>
      <div className="flex flex-wrap gap-3.5 mb-4">
        <KPI label="TOTAL SALES" value={pkr(totalSales)} tone="navy" />
        <KPI label="TOTAL PAID" value={pkr(totalPaid)} tone="green" />
        <KPI label="OUTSTANDING" value={pkr(balance)} tone="coral" />
        <KPI label="OPENING BALANCE" value={pkr(c.opening_balance)} tone="slate" />
        <KPI label="CREDIT LIMIT" value={pkr(c.credit_limit)} tone="slate" />
        <KPI label="AVAILABLE CREDIT" value={pkr(availableCredit)} tone={availableCredit < 0 ? "coral" : "aqua"} />
      </div>
      <div className="flex gap-2 flex-wrap text-xs">
        {AGING_BUCKETS.map((b) => (
          <span key={b} className={`px-2.5 py-1.5 rounded-lg border border-line ${aging[b] > 0 && b !== "Current" ? "bg-coralSoft text-coral font-semibold" : "text-slate"}`}>
            {b}: {pkr(aging[b])}
          </span>
        ))}
      </div>
      <p className="text-[11px] text-slate mt-1.5">Aging is approximate — based on unpaid invoice due dates, not payment-to-invoice allocation.</p>

      {/* DELIVERY */}
      <SectionTitle>Delivery</SectionTitle>
      <div className="flex flex-wrap gap-3.5 mb-4">
        <KPI label="TOTAL DELIVERIES" value={totalDeliveries} tone="navy" />
        <KPI label="LAST DELIVERY" value={lastDelivery ? fmtDate(lastDelivery.delivery_date) : "—"} tone="slate" />
        <KPI label="NEXT SCHEDULED" value={nextScheduled ? fmtDate(nextScheduled.delivery_date) : "—"} tone="aqua" />
        <KPI label="FAILED DELIVERIES" value={failedDeliveries} tone={failedDeliveries > 0 ? "coral" : "slate"} />
      </div>
      <table className="w-full text-xs border-collapse border border-line rounded-xl overflow-hidden">
        <thead><tr className="bg-foam"><Th>Date</Th><Th>Items</Th><Th>Status</Th><Th>Collected</Th></tr></thead>
        <tbody>
          {(deliveries || []).length === 0 && <tr><td colSpan={4} className="text-center py-5 text-slate">No deliveries yet.</td></tr>}
          {(deliveries || []).slice(0, 10).map((d) => (
            <tr key={d.id}>
              <Td>{fmtDate(d.delivery_date)}</Td>
              <Td>{(d.delivery_items || []).map((it) => `${it.products?.name || "?"} x${it.delivered_qty}`).join(", ") || "—"}</Td>
              <Td><Badge text={d.status} tone={DELIVERY_TONE(d.status)} /></Td>
              <Td>{pkr(d.amount_collected)}</Td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* BOTTLES */}
      <SectionTitle>Bottles</SectionTitle>
      <div className="flex flex-wrap gap-3.5 mb-4">
        <KPI label="BOTTLE BALANCE" value={totalBottleBalance} tone="aqua" sub="net bottles currently with this customer, all sizes" />
        <KPI label="BOTTLE LIMIT" value={c.bottle_limit} tone={totalBottleBalance > c.bottle_limit ? "coral" : "slate"} />
      </div>
      <table className="w-full text-xs border-collapse border border-line rounded-xl overflow-hidden">
        <thead><tr className="bg-foam"><Th>Size</Th><Th>Delivered</Th><Th>Returned</Th><Th>Damaged</Th><Th>Lost</Th><Th>Balance</Th></tr></thead>
        <tbody>
          {bottleRows.length === 0 && <tr><td colSpan={6} className="text-center py-5 text-slate">No bottle movements yet.</td></tr>}
          {bottleRows.map((r, i) => (
            <tr key={i}>
              <Td className="font-semibold">{r.name}</Td><Td>{r.delivered}</Td><Td>{r.returned}</Td>
              <Td className={r.damaged > 0 ? "text-coral" : ""}>{r.damaged}</Td>
              <Td className={r.lost > 0 ? "text-coral" : ""}>{r.lost}</Td>
              <Td className="font-semibold">{r.balance}</Td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* TRANSACTIONS */}
      <SectionTitle>Transactions</SectionTitle>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div>
          <h4 className="text-[13.5px] font-bold mb-2">Recent invoices</h4>
          <table className="w-full text-xs border-collapse border border-line rounded-xl overflow-hidden">
            <thead><tr className="bg-foam"><Th>Date</Th><Th>Invoice #</Th><Th>Total</Th><Th>Status</Th></tr></thead>
            <tbody>
              {(invoices || []).length === 0 && <tr><td colSpan={4} className="text-center py-5 text-slate">No invoices yet.</td></tr>}
              {(invoices || []).slice(0, 8).map((s) => (
                <tr key={s.id}><Td>{fmtDate(s.invoice_date)}</Td><Td>{s.invoice_no}</Td><Td>{pkr(s.net_amount)}</Td>
                  <Td><Badge text={s.status} tone={INVOICE_TONE[s.status] || "slate"} /></Td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <div>
          <h4 className="text-[13.5px] font-bold mb-2">Payments received</h4>
          <table className="w-full text-xs border-collapse border border-line rounded-xl overflow-hidden">
            <thead><tr className="bg-foam"><Th>Date</Th><Th>Amount</Th><Th>Method</Th></tr></thead>
            <tbody>
              {(payments || []).length === 0 && <tr><td colSpan={3} className="text-center py-5 text-slate">No payments yet.</td></tr>}
              {(payments || []).slice(0, 8).map((p) => <tr key={p.id}><Td>{fmtDate(p.payment_date)}</Td><Td>{pkr(p.amount)}</Td><Td>{p.method}</Td></tr>)}
            </tbody>
          </table>
        </div>
      </div>
      <div className="mt-4">
        <h4 className="text-[13.5px] font-bold mb-2">Customer ledger</h4>
        <table className="w-full text-xs border-collapse border border-line rounded-xl overflow-hidden">
          <thead><tr className="bg-foam"><Th>Date</Th><Th>Description</Th><Th>Debit</Th><Th>Credit</Th></tr></thead>
          <tbody>
            {(ledgerEntries || []).length === 0 && <tr><td colSpan={4} className="text-center py-5 text-slate">No ledger entries yet.</td></tr>}
            {(ledgerEntries || []).map((l) => (
              <tr key={l.id}><Td>{fmtDate(l.entry_date)}</Td><Td>{l.description}</Td>
                <Td>{Number(l.debit) > 0 ? pkr(l.debit) : "—"}</Td><Td>{Number(l.credit) > 0 ? pkr(l.credit) : "—"}</Td></tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ANALYTICS */}
      <SectionTitle>Analytics</SectionTitle>
      <div className="flex flex-wrap gap-3.5 mb-4">
        <KPI label="AVERAGE ORDER" value={pkr(avgOrder)} tone="navy" />
        <KPI label="ORDER FREQUENCY" value={`${orderFrequency.toFixed(1)}/mo`} tone="slate" />
        <KPI label="REVENUE (LIFETIME)" value={pkr(totalSales)} tone="aqua" sub="revenue-based — no per-unit cost data to compute true profit" />
        <KPI label="ACTIVITY" value={isRecentlyActive ? "Active" : "Quiet"} tone={isRecentlyActive ? "green" : "amber"} sub={lastActivity ? `Last activity ${fmtDate(lastActivity)}` : "No activity yet"} />
      </div>
      {monthlySales.length > 0 && (
        <div className="border border-line rounded-2xl p-4">
          <div className="text-xs font-semibold text-slate mb-2">Monthly sales (last {monthlySales.length} months)</div>
          <SalesTrendChart data={monthlySales} />
        </div>
      )}
    </div>
  );
}
