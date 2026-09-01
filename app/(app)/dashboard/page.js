import { createClient } from "@/lib/supabase/server";
import { pkr } from "@/lib/format";
import { KPI } from "@/components/ui";
import { SalesTrendChart, ExpensePie } from "@/components/DashboardCharts";
import { AlertTriangle } from "lucide-react";

function todayISO() { return new Date().toISOString().slice(0, 10); }
function daysAgo(n) { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); }
const BOTTLE_COST = 800;

export const dynamic = "force-dynamic"; // always fetch fresh — this is a live multi-user dashboard

export default async function DashboardPage() {
  const supabase = await createClient();
  const today = todayISO();

  const [
    { data: todayInvoices }, { data: todayDeliveries }, { data: todayExpenses }, { data: customerBalances },
    { data: products }, { data: recentInvoices }, { data: allExpenses }, { data: cashBalances },
    { data: bottleStock }, { data: bottleWithCustomers }, { data: supplierBalances }, { data: prices },
    activeCustomersRes, { data: overdueCustomers },
  ] = await Promise.all([
    supabase.from("invoices").select("net_amount, invoice_items(quantity)").eq("invoice_date", today).neq("status", "void"),
    supabase.from("deliveries").select("*, delivery_items(delivered_qty)").eq("delivery_date", today),
    supabase.from("expenses").select("*").eq("expense_date", today),
    supabase.from("v_customer_balance").select("balance"),
    supabase.from("products").select("id, name, low_stock_threshold"),
    supabase.from("invoices").select("net_amount, invoice_date").gte("invoice_date", daysAgo(6)).neq("status", "void"),
    supabase.from("expenses").select("expense_categories(name), amount"),
    supabase.from("v_cash_account_balance").select("name, type, current_balance"),
    supabase.from("v_bottle_reconciliation").select("product_id, warehouse"),
    supabase.from("v_customer_bottle_balance").select("bottles_with_customer"),
    supabase.from("v_supplier_balance").select("balance"),
    supabase.from("product_prices").select("product_id, price"),
    supabase.from("customers").select("id", { count: "exact", head: true }).eq("is_active", true),
    supabase.from("v_customer_balance").select("customer_id, name, balance").gt("balance", 1000).order("balance", { ascending: false }).limit(5),
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
  const outstanding = receivables;
  const activeCustomers = activeCustomersRes.count || 0;
  const grossProfit = salesAmt - bottlesDelivered * 55;

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

  return (
    <div>
      <h2 className="font-display text-2xl font-semibold mb-0.5">How is the business doing today?</h2>
      <p className="text-slate text-sm mb-5">{new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" })} · live from Postgres</p>

      <div className="flex flex-wrap gap-3 mb-6">
        <KPI label="TODAY'S SALES" value={pkr(salesAmt)} tone="navy" sub={`${(todayInvoices || []).length} invoices`} />
        <KPI label="BOTTLES DELIVERED" value={bottlesDelivered} tone="aqua" />
        <KPI label="OUTSTANDING" value={pkr(outstanding)} tone="coral" />
        <KPI label="TODAY'S EXPENSES" value={pkr(expAmt)} tone="amber" />
        <KPI label="EST. GROSS PROFIT" value={pkr(grossProfit)} tone="navy" sub="revenue − product cost" />
        <KPI label="ACTIVE CUSTOMERS" value={activeCustomers} tone="aqua" />
      </div>

      <h4 className="text-xs font-bold tracking-wide text-slate mb-2">ACCOUNTING SNAPSHOT</h4>
      <div className="flex flex-wrap gap-3 mb-6">
        <KPI label="CASH" value={pkr(cashBalance)} tone="green" />
        <KPI label="BANK" value={pkr(bankBalance)} tone="green" />
        <KPI label="RECEIVABLES" value={pkr(receivables)} tone="coral" />
        <KPI label="PAYABLES" value={pkr(payables)} tone="amber" />
        <KPI label="INVENTORY VALUE" value={pkr(inventoryValue)} tone="aqua" sub="at current selling price" />
        <KPI label="BOTTLE LIABILITY" value={pkr(bottleLiability)} tone="navy" sub={`${withCustomersBottles} bottles with customers`} />
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
