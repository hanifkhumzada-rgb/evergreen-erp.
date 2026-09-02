import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { pkr } from "@/lib/format";
import { KPI } from "@/components/ui";
import { SalesTrendChart, ExpensePie } from "@/components/DashboardCharts";
import {
  AlertTriangle, UserPlus, Truck, ShoppingCart, Receipt, Wallet, Upload, BarChart3, Bot,
} from "lucide-react";

function todayISO() { return new Date().toISOString().slice(0, 10); }
function daysAgo(n) { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); }
function monthStartISO() { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10); }
function lastMonthRange() {
  const d = new Date();
  const start = new Date(d.getFullYear(), d.getMonth() - 1, 1);
  const end = new Date(d.getFullYear(), d.getMonth(), 0);
  return { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) };
}
const BOTTLE_COST = 800;

export const dynamic = "force-dynamic"; // always fetch fresh — this is a live multi-user dashboard

// Percent change vs. the previous period. lowerIsBetter flips which direction
// counts as "favorable" (e.g. expenses, outstanding, payables trending down is good).
function calcTrend(current, previous, lowerIsBetter = false) {
  current = Number(current) || 0;
  previous = Number(previous) || 0;
  if (current === previous) return { direction: "flat", pct: 0, favorable: null };
  if (previous === 0) return { direction: "up", pct: 100, favorable: !lowerIsBetter };
  const pctChange = ((current - previous) / Math.abs(previous)) * 100;
  const direction = pctChange > 0 ? "up" : "down";
  const favorable = direction === "up" ? !lowerIsBetter : lowerIsBetter;
  return { direction, pct: Math.round(Math.abs(pctChange)), favorable };
}

const QUICK_ACTIONS = [
  { label: "New Customer", href: "/customers", icon: UserPlus },
  { label: "New Delivery", href: "/deliveries", icon: Truck },
  { label: "New Sale", href: "/sales", icon: ShoppingCart },
  { label: "Receive Payment", href: "/payments", icon: Receipt },
  { label: "Add Expense", href: "/expenses", icon: Wallet },
  { label: "Import Excel", href: "/sales", icon: Upload },
  { label: "View Reports", href: "/reports", icon: BarChart3 },
];

export default async function DashboardPage() {
  const supabase = await createClient();
  const today = todayISO();
  const yesterday = daysAgo(1);

  const [
    { data: todayInvoices }, { data: todayDeliveries }, { data: todayExpenses }, { data: customerBalances },
    { data: products }, { data: recentInvoices }, { data: allExpenses }, { data: cashBalances },
    { data: bottleStock }, { data: bottleWithCustomers }, { data: supplierBalances }, { data: prices },
    activeCustomersRes, { data: overdueCustomers },
    { data: yesterdayInvoices }, { data: yesterdayExpenses }, { data: yesterdayDeliveries },
    { data: todayPayments }, { data: todayPurchases }, { data: todayCashTxns },
    yesterdayActiveCustomersRes,
    overdueRuleRes, { data: unpaidInvoices }, { data: monthToDateExpenses }, { data: lastMonthExpenses },
  ] = await Promise.all([
    supabase.from("invoices").select("net_amount, invoice_items(quantity)").eq("invoice_date", today).neq("status", "void"),
    supabase.from("deliveries").select("*, delivery_items(delivered_qty, returned_qty)").eq("delivery_date", today),
    supabase.from("expenses").select("*").eq("expense_date", today).in("status", ["approved", "paid"]),
    supabase.from("v_customer_balance").select("balance"),
    supabase.from("products").select("id, name, low_stock_threshold"),
    // widened to 13 days back so the same fetch covers both the 7-day trend chart
    // and a prior-week comparison for the AI insights card; also carries zone info
    // for the "top zone this week" insight.
    supabase.from("invoices").select("net_amount, invoice_date, customers(zone_id, zones(name))").gte("invoice_date", daysAgo(13)).neq("status", "void"),
    supabase.from("expenses").select("expense_categories(name), amount").in("status", ["approved", "paid"]),
    supabase.from("v_cash_account_balance").select("name, type, current_balance"),
    supabase.from("v_bottle_reconciliation").select("product_id, warehouse"),
    supabase.from("v_customer_bottle_balance").select("bottles_with_customer"),
    supabase.from("v_supplier_balance").select("balance"),
    supabase.from("product_prices").select("product_id, price"),
    supabase.from("customers").select("id", { count: "exact", head: true }).eq("is_active", true),
    supabase.from("v_customer_balance").select("customer_id, name, balance").gt("balance", 1000).order("balance", { ascending: false }).limit(5),
    // Previous-period comparisons (yesterday for daily flow metrics; today's own
    // movement, reversed out of the current balance, for point-in-time balances —
    // there's no historical snapshot table, so this is the standard way to derive
    // "yesterday's balance" without one).
    supabase.from("invoices").select("net_amount, invoice_items(quantity)").eq("invoice_date", yesterday).neq("status", "void"),
    supabase.from("expenses").select("amount").eq("expense_date", yesterday).in("status", ["approved", "paid"]),
    supabase.from("deliveries").select("*, delivery_items(delivered_qty)").eq("delivery_date", yesterday),
    supabase.from("payments").select("amount").eq("payment_date", today),
    supabase.from("purchases").select("purchase_date, purchase_items(quantity, rate, discount)").eq("purchase_date", today),
    supabase.from("cash_transactions").select("amount, cash_accounts(type)").eq("txn_date", today),
    supabase.from("customers").select("id", { count: "exact", head: true }).eq("is_active", true).lt("created_at", `${today}T00:00:00`),
    // AI Business Insights card inputs (Phase 3)
    supabase.from("automation_rules").select("enabled, threshold_value").eq("key", "payment_overdue").maybeSingle(),
    supabase.from("invoices").select("customer_id, due_date").neq("status", "paid").neq("status", "void").not("due_date", "is", null),
    supabase.from("expenses").select("amount, expense_categories(name)").in("status", ["approved", "paid"]).gte("expense_date", monthStartISO()),
    supabase.from("expenses").select("amount, expense_categories(name)").in("status", ["approved", "paid"]).gte("expense_date", lastMonthRange().from).lte("expense_date", lastMonthRange().to),
  ]);

  const cashBalance = (cashBalances || []).filter((a) => a.type === "cash").reduce((a, c) => a + Number(c.current_balance), 0);
  const bankBalance = (cashBalances || []).filter((a) => a.type === "bank").reduce((a, c) => a + Number(c.current_balance), 0);
  const receivables = (customerBalances || []).reduce((a, c) => a + Number(c.balance), 0);
  const payables = (supplierBalances || []).reduce((a, s) => a + Number(s.balance), 0);

  const priceMap = {};
  (prices || []).forEach((p) => { priceMap[p.product_id] = Number(p.price); });
  const stockMap = {};
  (bottleStock || []).forEach((s) => { stockMap[s.product_id] = Number(s.warehouse); });
  const inventoryValue = (products || []).reduce((a, p) => a + (stockMap[p.id] || 0) * (priceMap[p.id] || 0), 0);
  const withCustomersBottles = (bottleWithCustomers || []).reduce((a, b) => a + Number(b.bottles_with_customer), 0);
  const bottleLiability = withCustomersBottles * BOTTLE_COST;

  const salesAmt = (todayInvoices || []).reduce((a, s) => a + Number(s.net_amount), 0);
  const expAmt = (todayExpenses || []).reduce((a, e) => a + Number(e.amount), 0);
  const bottlesDelivered = (todayDeliveries || []).filter((d) => d.status === "delivered").reduce((a, d) => a + (d.delivery_items || []).reduce((b, i) => b + Number(i.delivered_qty), 0), 0);
  const emptiesReturned = (todayDeliveries || []).filter((d) => d.status === "delivered").reduce((a, d) => a + (d.delivery_items || []).reduce((b, i) => b + Number(i.returned_qty), 0), 0);
  const outstanding = receivables;
  const activeCustomers = activeCustomersRes.count || 0;
  const grossProfit = salesAmt - bottlesDelivered * 55;

  // Previous-period figures
  const ySalesAmt = (yesterdayInvoices || []).reduce((a, s) => a + Number(s.net_amount), 0);
  const yExpAmt = (yesterdayExpenses || []).reduce((a, e) => a + Number(e.amount), 0);
  const yBottlesDelivered = (yesterdayDeliveries || []).filter((d) => d.status === "delivered").reduce((a, d) => a + (d.delivery_items || []).reduce((b, i) => b + Number(i.delivered_qty), 0), 0);
  const yGrossProfit = ySalesAmt - yBottlesDelivered * 55;
  const yActiveCustomers = yesterdayActiveCustomersRes.count || 0;

  const todayPaymentsAmt = (todayPayments || []).reduce((a, p) => a + Number(p.amount), 0);
  const yReceivables = receivables - salesAmt + todayPaymentsAmt;

  const todayPurchasesAmt = (todayPurchases || []).reduce((a, p) => a + (p.purchase_items || []).reduce((b, it) => b + Number(it.quantity) * Number(it.rate) - Number(it.discount || 0), 0), 0);
  const yPayables = payables - todayPurchasesAmt;

  const netBottlesToday = bottlesDelivered - emptiesReturned;
  const yBottleLiability = bottleLiability - netBottlesToday * BOTTLE_COST;

  const todayCashMovement = (todayCashTxns || []).filter((t) => t.cash_accounts?.type === "cash").reduce((a, t) => a + Number(t.amount), 0);
  const todayBankMovement = (todayCashTxns || []).filter((t) => t.cash_accounts?.type === "bank").reduce((a, t) => a + Number(t.amount), 0);
  const yCashBalance = cashBalance - todayCashMovement;
  const yBankBalance = bankBalance - todayBankMovement;

  const trend = Array.from({ length: 7 }).map((_, i) => {
    const day = daysAgo(6 - i);
    const amt = (recentInvoices || []).filter((s) => s.invoice_date === day).reduce((a, s) => a + Number(s.net_amount), 0);
    return { day: day.slice(5), sales: amt };
  });
  const expenseBreak = Object.values((allExpenses || []).reduce((acc, e) => {
    const name = e.expense_categories?.name || "Other";
    acc[name] = acc[name] || { name, value: 0 };
    acc[name].value += Number(e.amount);
    return acc;
  }, {}));

  const lowStock = (products || []).filter((p) => (stockMap[p.id] || 0) < p.low_stock_threshold);

  // AI Business Insights (Phase 3) — plain JS over the data already fetched
  // above, no external AI call. Every bullet below is traced to one of these
  // computed facts, never generic filler text.
  const thisWeekDays = Array.from({ length: 7 }).map((_, i) => daysAgo(6 - i));
  const priorWeekDays = Array.from({ length: 7 }).map((_, i) => daysAgo(13 - i));
  const thisWeekSum = trend.reduce((a, t) => a + t.sales, 0);
  const priorWeekSum = (recentInvoices || []).filter((s) => priorWeekDays.includes(s.invoice_date)).reduce((a, s) => a + Number(s.net_amount), 0);
  const weekTrend = calcTrend(thisWeekSum, priorWeekSum);

  const zoneRevThisWeek = {};
  (recentInvoices || []).filter((s) => thisWeekDays.includes(s.invoice_date)).forEach((s) => {
    const z = s.customers?.zones?.name || "Unassigned";
    zoneRevThisWeek[z] = (zoneRevThisWeek[z] || 0) + Number(s.net_amount);
  });
  const topZone = Object.entries(zoneRevThisWeek).sort((a, b) => b[1] - a[1])[0];

  const overdueDays = overdueRuleRes.data?.enabled === false ? null : (Number(overdueRuleRes.data?.threshold_value) || 30);
  const overdueCutoff = overdueDays != null ? daysAgo(overdueDays) : null;
  const overdueCustomerCount = overdueCutoff
    ? new Set((unpaidInvoices || []).filter((i) => i.due_date && i.due_date < overdueCutoff).map((i) => i.customer_id)).size
    : null;

  const sumByCat = (rows) => {
    const m = {};
    (rows || []).forEach((e) => { const c = e.expense_categories?.name || "Other"; m[c] = (m[c] || 0) + Number(e.amount); });
    return m;
  };
  const thisMonthCat = sumByCat(monthToDateExpenses);
  const lastMonthCat = sumByCat(lastMonthExpenses);
  const catJumps = Object.keys(thisMonthCat)
    .map((c) => ({ cat: c, from: lastMonthCat[c] || 0, to: thisMonthCat[c], diff: thisMonthCat[c] - (lastMonthCat[c] || 0) }))
    .filter((c) => c.diff > 0 && c.from > 0)
    .sort((a, b) => (b.diff / b.from) - (a.diff / a.from));
  const biggestJump = catJumps[0];

  const insights = [];
  insights.push(
    weekTrend.direction === "flat"
      ? `Sales this week (${pkr(thisWeekSum)}) are flat vs last week (${pkr(priorWeekSum)}).`
      : `Sales this week (${pkr(thisWeekSum)}) are ${weekTrend.direction === "up" ? "up" : "down"} ${weekTrend.pct}% vs last week (${pkr(priorWeekSum)}).`
  );
  if (topZone) insights.push(`${topZone[0]} generated the most revenue this week (${pkr(topZone[1])}).`);
  if (overdueCustomerCount != null) {
    insights.push(overdueCustomerCount > 0
      ? `${overdueCustomerCount} customer${overdueCustomerCount === 1 ? " is" : "s are"} overdue by more than ${overdueDays} days.`
      : `No customers are currently overdue by more than ${overdueDays} days.`);
  }
  if (biggestJump) {
    const pct = Math.round((biggestJump.diff / biggestJump.from) * 100);
    insights.push(`${biggestJump.cat} expenses jumped from ${pkr(biggestJump.from)} to ${pkr(biggestJump.to)} this month (+${pct}%).`);
  }

  const actions = [];
  if (overdueCustomerCount > 0) actions.push({ text: `Follow up with ${overdueCustomerCount} overdue customer${overdueCustomerCount === 1 ? "" : "s"}.`, href: "/ledger" });
  if (biggestJump) actions.push({ text: `Review the rise in ${biggestJump.cat} expenses.`, href: "/expenses" });
  if (weekTrend.direction === "down" && weekTrend.favorable === false) actions.push({ text: "Sales are down this week — check in with the sales team.", href: "/sales" });

  return (
    <div>
      <h2 className="font-display text-2xl font-semibold mb-0.5">How is the business doing today?</h2>
      <p className="text-slate text-sm mb-5">{new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" })} · live from Postgres</p>

      <div className="no-print grid grid-cols-2 gap-2.5 mb-6 max-w-md">
        {QUICK_ACTIONS.map((a) => {
          const Icon = a.icon;
          return (
            <Link key={a.label} href={a.href}
              className="card-lift flex flex-col items-center justify-center gap-1.5 py-4 px-2 rounded-xl border border-line bg-card text-center hover:bg-foam transition-colors">
              <div className="w-9 h-9 rounded-full bg-aquaSoft flex items-center justify-center">
                <Icon size={16} className="text-aqua" />
              </div>
              <span className="text-xs font-semibold leading-tight">{a.label}</span>
            </Link>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-3.5 mb-6">
        <KPI label="TODAY'S SALES" value={pkr(salesAmt)} tone="navy" sub={`${(todayInvoices || []).length} invoices`} trend={calcTrend(salesAmt, ySalesAmt)} href="/sales" />
        <KPI label="BOTTLES DELIVERED" value={bottlesDelivered} tone="aqua" />
        <KPI label="OUTSTANDING" value={pkr(outstanding)} tone="coral" trend={calcTrend(outstanding, yReceivables, true)} href="/ledger" />
        <KPI label="TODAY'S EXPENSES" value={pkr(expAmt)} tone="amber" trend={calcTrend(expAmt, yExpAmt, true)} href="/expenses" />
        <KPI label="EST. GROSS PROFIT" value={pkr(grossProfit)} tone="navy" sub="revenue − product cost" trend={calcTrend(grossProfit, yGrossProfit)} href="/accounting/profit-loss" />
        <KPI label="ACTIVE CUSTOMERS" value={activeCustomers} tone="aqua" trend={calcTrend(activeCustomers, yActiveCustomers)} href="/customers" />
      </div>

      <h4 className="text-xs font-bold tracking-wide text-slate mb-2">ACCOUNTING SNAPSHOT</h4>
      <div className="flex flex-wrap gap-3.5 mb-6">
        <KPI label="CASH" value={pkr(cashBalance)} tone="green" trend={calcTrend(cashBalance, yCashBalance)} href="/accounting/chart-of-accounts" />
        <KPI label="BANK" value={pkr(bankBalance)} tone="green" trend={calcTrend(bankBalance, yBankBalance)} href="/accounting/chart-of-accounts" />
        <KPI label="RECEIVABLES" value={pkr(receivables)} tone="coral" trend={calcTrend(receivables, yReceivables, true)} href="/ledger" />
        <KPI label="PAYABLES" value={pkr(payables)} tone="amber" trend={calcTrend(payables, yPayables, true)} href="/accounting/chart-of-accounts" />
        <KPI label="INVENTORY VALUE" value={pkr(inventoryValue)} tone="aqua" sub="at current selling price" href="/inventory" />
        <KPI label="BOTTLE LIABILITY" value={pkr(bottleLiability)} tone="navy" sub={`${withCustomersBottles} bottles with customers`} trend={calcTrend(bottleLiability, yBottleLiability, true)} href="/bottle-ledger" />
      </div>

      <div className="border border-line rounded-2xl p-4 mb-4">
        <h4 className="text-sm font-bold mb-2.5 flex items-center gap-1.5"><Bot size={15} className="text-aqua" /> AI Business Insights</h4>
        <ul className="flex flex-col gap-1.5 mb-3">
          {insights.map((text, i) => (
            <li key={i} className="text-xs flex gap-2"><span className="text-aqua flex-shrink-0">•</span><span>{text}</span></li>
          ))}
        </ul>
        {actions.length > 0 && (
          <>
            <div className="text-[10px] font-bold tracking-wide text-slate mb-1.5">RECOMMENDED ACTIONS</div>
            <div className="flex flex-col gap-1">
              {actions.map((a, i) => (
                <Link key={i} href={a.href} className="text-xs text-aqua font-semibold hover:underline">→ {a.text}</Link>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-4 mb-4">
        <div className="border border-line rounded-2xl p-4">
          <h4 className="text-sm font-bold mb-2">Sales trend — last 7 days</h4>
          <SalesTrendChart data={trend} />
        </div>
        <div className="border border-line rounded-2xl p-4">
          <h4 className="text-sm font-bold mb-2">Expense breakdown</h4>
          {expenseBreak.length ? <ExpensePie data={expenseBreak} /> : <p className="text-sm text-slate py-10 text-center">No expenses recorded yet.</p>}
        </div>
      </div>

      <div className="border border-line rounded-2xl p-4">
        <h4 className="text-sm font-bold mb-2 flex items-center gap-1.5"><AlertTriangle size={15} className="text-coral" /> Alerts</h4>
        <div className="flex flex-col gap-2 max-h-52 overflow-y-auto">
          {lowStock.map((p) => (
            <div key={p.id} className="text-xs flex gap-2"><AlertTriangle size={13} className="text-coral flex-shrink-0 mt-0.5" /><span>{p.name} is below reorder level ({stockMap[p.id] || 0}/{p.low_stock_threshold}).</span></div>
          ))}
          {(overdueCustomers || []).map((c) => (
            <div key={c.customer_id} className="text-xs flex gap-2"><AlertTriangle size={13} className="text-amber flex-shrink-0 mt-0.5" /><span>{c.name} has an outstanding balance of {pkr(c.balance)}.</span></div>
          ))}
          {lowStock.length + (overdueCustomers || []).length === 0 && <p className="text-sm text-slate">No critical alerts right now.</p>}
        </div>
      </div>
    </div>
  );
}
