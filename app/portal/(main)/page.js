import Link from "next/link";
import { Droplet, Wallet, Calendar, Truck, RotateCcw, Bell, PackagePlus, CalendarOff, MessageCircle } from "lucide-react";
import { requirePortalCustomer } from "@/app/portal/actions";
import { pkr, fmtDate } from "@/lib/format";
import CustomerRiderMap from "@/components/portal/CustomerRiderMap";
import PortalWelcome from "@/components/portal/PortalWelcome";

export const dynamic = "force-dynamic";

const FREQ_DAYS = { Daily: 1, Weekly: 7, Monthly: 30, Custom: 30 };

function Stat({ icon: Icon, label, value, sub, tone = "navy", href }) {
  const bg = { navy: "bg-navyLight text-white", card: "bg-card border border-line" }[tone];
  const sec = tone === "navy" ? "text-[#BFE3E0]" : "text-slate";
  const content = (
    <div className={`h-full rounded-2xl p-4 ${bg}`}>
      <div className={`flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wide ${sec}`}>
        <Icon size={12} /> {label}
      </div>
      <div className="font-mono-num text-lg sm:text-xl font-bold mt-1.5 break-words">{value}</div>
      {sub && <div className={`text-[11px] mt-0.5 ${sec}`}>{sub}</div>}
      {href && <div className={`text-[10px] font-semibold mt-2 ${sec}`}>View details →</div>}
    </div>
  );
  return href ? <Link href={href} className="min-w-0 rounded-2xl transition-shadow hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-aqua">{content}</Link> : content;
}

export default async function PortalDashboardPage() {
  const { supabase, customerId } = await requirePortalCustomer();
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);

  const [
    { data: customer }, { data: todayDeliveries }, { data: monthDeliveries },
    { data: bottleBalances }, { data: ledgerEntries }, { data: lastPayment }, { data: recentNotifications },
    { data: businessSettings },
  ] = await Promise.all([
    supabase.from("customers").select("name, code, opening_balance, payment_frequency, bottle_limit").eq("id", customerId).maybeSingle(),
    supabase.from("deliveries").select("id, delivery_no, status, amount, rider_id, delivered_at, delivery_items(delivered_qty, returned_qty, products(name))")
      .eq("customer_id", customerId).eq("delivery_date", today).order("created_at", { ascending: false }),
    supabase.from("deliveries").select("id, amount, status, delivery_items(delivered_qty, returned_qty)")
      .eq("customer_id", customerId).gte("delivery_date", monthStart).lte("delivery_date", today).eq("status", "delivered"),
    supabase.from("v_customer_bottle_balance").select("product_name, bottles_with_customer").eq("customer_id", customerId),
    supabase.from("customer_ledger_entries").select("debit, credit").eq("customer_id", customerId),
    supabase.from("payments").select("amount, payment_date").eq("customer_id", customerId).eq("voided", false).order("payment_date", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("customer_notifications").select("id, title, message, created_at, is_read").eq("customer_id", customerId).order("created_at", { ascending: false }).limit(3),
    // Owner-controlled toggle (Automation Center) — business_settings has
    // no business_id column (still a single global row, same as every
    // other reader of this table) and is readable by any authenticated
    // session, customer portal included (p_settings_select).
    supabase.from("business_settings").select("customer_live_tracking_enabled").maybeSingle(),
  ]);

  const liveTrackingEnabled = businessSettings?.customer_live_tracking_enabled !== false;

  const openingBalance = Number(customer?.opening_balance) || 0;
  const ledgerNet = (ledgerEntries || []).reduce((sum, e) => sum + (Number(e.debit) || 0) - (Number(e.credit) || 0), 0);
  const outstanding = openingBalance + ledgerNet;

  const monthBottles = (monthDeliveries || []).reduce((sum, d) => sum + (d.delivery_items || []).reduce((s, i) => s + (i.delivered_qty || 0), 0), 0);
  const monthReturns = (monthDeliveries || []).reduce((sum, d) => sum + (d.delivery_items || []).reduce((s, i) => s + (i.returned_qty || 0), 0), 0);
  const monthAmount = (monthDeliveries || []).reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
  const totalBottleBalance = (bottleBalances || []).reduce((sum, b) => sum + (Number(b.bottles_with_customer) || 0), 0);

  const freq = customer?.payment_frequency || "Monthly";
  const nextDueDate = lastPayment?.payment_date
    ? new Date(new Date(lastPayment.payment_date).getTime() + (FREQ_DAYS[freq] || 30) * 86400000)
    : null;

  // Reuses the existing GPS tracking infrastructure (staff_locations +
  // its Realtime publication) — RLS (p_staff_locations_customer_self)
  // is what actually restricts this to only the rider currently out for
  // delivery to THIS customer; this query just asks for it, the database
  // enforces whether it's allowed to answer. Also gated on the Owner's
  // "Customers can see live delivery tracking" toggle (Automation
  // Center, business_settings.customer_live_tracking_enabled) — skip the
  // query entirely when it's off, not just hide the result.
  const outForDelivery = liveTrackingEnabled && (todayDeliveries || []).find((d) => d.status === "out_for_delivery" && d.rider_id);
  let riderLocation = null;
  if (outForDelivery) {
    const { data: loc } = await supabase.from("staff_locations").select("latitude, longitude")
      .eq("user_id", outForDelivery.rider_id).order("recorded_at", { ascending: false }).limit(1).maybeSingle();
    riderLocation = loc;
  }

  return (
    <div className="flex flex-col gap-5">
      <PortalWelcome name={customer?.name} code={customer?.code} date={fmtDate(today)} />

      <div className="grid grid-cols-3 gap-2 rounded-2xl border border-line bg-card p-2 text-center text-[11px] font-bold">
        <Link href="/portal/deliveries" className="rounded-xl py-3 hover:bg-aquaSoft focus-visible:outline focus-visible:outline-aqua"><Truck size={18} className="mx-auto mb-1 text-aqua"/>Delivery history</Link>
        <Link href="/portal/bottles" className="rounded-xl py-3 hover:bg-aquaSoft focus-visible:outline focus-visible:outline-aqua"><Droplet size={18} className="mx-auto mb-1 text-aqua"/>My bottles</Link>
        <Link href="/portal/statement" className="rounded-xl py-3 hover:bg-aquaSoft focus-visible:outline focus-visible:outline-aqua"><Wallet size={18} className="mx-auto mb-1 text-aqua"/>Statement</Link>
      </div>

      <div><h2 className="text-xs font-bold text-slate uppercase tracking-wide mb-2">Quick actions</h2><div className="grid grid-cols-3 gap-2.5">
        <Link href="/portal/support?type=Extra%20Order%20Request" className="rounded-2xl border bg-card p-3 text-center hover:border-aqua"><PackagePlus size={20} className="mx-auto text-aqua"/><span className="block text-[10px] font-semibold mt-1.5">Extra Order</span></Link>
        <Link href="/portal/support?type=Pause%20Delivery" className="rounded-2xl border bg-card p-3 text-center hover:border-aqua"><CalendarOff size={20} className="mx-auto text-amber"/><span className="block text-[10px] font-semibold mt-1.5">Pause Delivery</span></Link>
        <Link href="/portal/support" className="rounded-2xl border bg-card p-3 text-center hover:border-aqua"><MessageCircle size={20} className="mx-auto text-aqua"/><span className="block text-[10px] font-semibold mt-1.5">Get Help</span></Link>
      </div></div>

      <div>
        <h2 className="text-xs font-bold text-slate uppercase tracking-wide mb-2">Today</h2>
        {todayDeliveries?.length ? (
          <div className="flex flex-col gap-2">
            {todayDeliveries.map((d) => (
              <Link href={`/portal/deliveries/${d.id}`} key={d.id} className="bg-card border border-line rounded-2xl p-4 flex flex-wrap gap-2 items-center justify-between hover:border-aqua">
                <div className="min-w-0">
                  <div className="text-sm font-bold flex items-center gap-1.5 break-all"><Truck size={14} className="text-aqua shrink-0" /> {d.delivery_no}</div>
                  <div className="text-xs text-slate mt-1">
                    {(d.delivery_items || []).map((i) => `${i.products?.name || "Item"}: ${i.delivered_qty}`).join(", ") || "—"}
                  </div>
                </div>
                <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full capitalize ${d.status === "delivered" ? "bg-greenSoft text-green" : d.status === "cancelled" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-800"}`}>{d.status.replaceAll("_", " ")} →</span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="bg-card border border-line rounded-2xl p-4 text-xs text-slate">No delivery scheduled for today yet. <Link href="/portal/deliveries" className="block font-semibold text-aqua mt-2">View previous deliveries →</Link></div>
        )}
        {outForDelivery && riderLocation && (
          <div className="mt-2.5">
            <CustomerRiderMap riderId={outForDelivery.rider_id} initialLocation={riderLocation} />
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Stat icon={Wallet} label={outstanding < 0 ? "Account Credit" : "Outstanding"} value={pkr(Math.abs(outstanding))} tone="navy" href="/portal/statement" sub={outstanding === 0 ? "Your account is clear" : outstanding < 0 ? "Credit available on your account" : "Check your statement for details"} />
        <Stat icon={Calendar} label="Payment Cycle" value={freq} sub={nextDueDate ? `Estimated next date: ${fmtDate(nextDueDate.toISOString())}` : "Check statement for invoice due dates"} tone="card" href="/portal/statement" />
        <Stat icon={Droplet} label="Bottles with you" value={totalBottleBalance} sub="Issued minus empty bottles returned" tone="card" href="/portal/bottles" />
        <Stat icon={Wallet} label="Last Payment" value={lastPayment ? pkr(lastPayment.amount) : "—"} sub={lastPayment ? fmtDate(lastPayment.payment_date) : "No payments yet"} tone="card" href="/portal/payments" />
      </div>

      <div>
        <h2 className="text-xs font-bold text-slate uppercase tracking-wide mb-2">This Month · Completed deliveries</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Stat icon={Droplet} label="Bottles" value={monthBottles} tone="card" />
          <Stat icon={RotateCcw} label="Returns" value={monthReturns} tone="card" />
          <Stat icon={Wallet} label="Amount" value={pkr(monthAmount)} tone="card" />
        </div>
      </div>

      {recentNotifications?.length > 0 && (
        <div>
          <h2 className="text-xs font-bold text-slate uppercase tracking-wide mb-2 flex items-center gap-1.5"><Bell size={12} /> Recent Updates</h2>
          <div className="flex flex-col gap-2">
            {recentNotifications.map((n) => (
              <div key={n.id} className={`rounded-2xl p-3.5 border ${n.is_read ? "bg-card border-line" : "bg-aquaSoft border-aqua/30"}`}>
                <div className="text-xs font-bold">{n.title}</div>
                <div className="text-[11px] text-slate mt-0.5">{n.message}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-3">
        <Link href="/portal/statement" className="flex-1 text-center py-3 rounded-2xl bg-navyLight text-white text-xs font-bold">View Statement</Link>
        <Link href="/portal/support" className="flex-1 text-center py-3 rounded-2xl border border-line text-xs font-bold">Report an Issue</Link>
      </div>
      <p className="text-center text-[11px] text-slate">Need extra water or a delivery change? Send a request above; our team will confirm it.</p>
    </div>
  );
}
