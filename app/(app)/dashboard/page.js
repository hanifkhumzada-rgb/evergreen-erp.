import { createClient } from "@/lib/supabase/server";
import { KPI, pkr } from "@/components/ui";
import { SalesTrendChart, ExpensePie } from "@/components/DashboardCharts";
import { AlertTriangle } from "lucide-react";

function todayISO() { return new Date().toISOString().slice(0, 10); }
function daysAgo(n) { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); }

export const dynamic = "force-dynamic"; // always fetch fresh — this is a live multi-user dashboard

export default async function DashboardPage() {
  const supabase = createClient();
  const today = todayISO();

  const [{ data: todaySales }, { data: todayDeliveries }, { data: todayExpenses }, { data: customers }, { data: products }, { data: recentSales }, { data: allExpenses }, { data: journalLines }] = await Promise.all([
    supabase.from("sales").select("*").eq("sale_date", today),
    supabase.from("deliveries").select("*").eq("del_date", today),
    supabase.from("expenses").select("*").eq("exp_date", today),
    supabase.from("customers").select("*"),
    supabase.from("products").select("*"),
    supabase.from("sales").select("total, sale_date").gte("sale_date", daysAgo(6)),
    supabase.from("expenses").select("category, amount"),
    supabase.from("journal_lines").select("debit, credit, chart_of_accounts(name, type)"),
  ]);

  const acctBalance = (name) => (journalLines || []).filter((l) => l.chart_of_accounts?.name === name)
    .reduce((a, l) => a + Number(l.debit) - Number(l.credit), 0);
  const cashBalance = acctBalance("Cash");
  const bankBalance = acctBalance("Bank");
  const receivables = acctBalance("Accounts Receivable");
  const payables = -acctBalance("Accounts Payable");
  const inventoryValue = (products || []).reduce((a, p) => a + p.stock * Number(p.cost), 0);
  const withCustomersBottles = (customers || []).reduce((a, c) => a + (c.bottles_delivered - c.bottles_returned), 0);
  const bottleLiability = withCustomersBottles * 800;

  const salesAmt = (todaySales || []).reduce((a, s) => a + Number(s.total), 0);
  const paidToday = (todaySales || []).reduce((a, s) => a + Number(s.paid), 0);
  const expAmt = (todayExpenses || []).reduce((a, e) => a + Number(e.amount), 0);
  const bottlesDelivered = (todayDeliveries || []).filter((d) => d.status === "Delivered").reduce((a, d) => a + d.qty, 0);
  const outstanding = (customers || []).reduce((a, c) => a + Number(c.balance), 0);
  const activeCustomers = (customers || []).filter((c) => c.status === "Active").length;
  const grossProfit = salesAmt - bottlesDelivered * 55;

  const trend = Array.from({ length: 7 }).map((_, i) => {
    const day = daysAgo(6 - i);
    const amt = (recentSales || []).filter((s) => s.sale_date === day).reduce((a, s) => a + Number(s.total), 0);
    return { day: day.slice(5), sales: amt };
  });
  const expenseBreak = Object.values((allExpenses || []).reduce((acc, e) => {
    acc[e.category] = acc[e.category] || { name: e.category, value: 0 };
    acc[e.category].value += Number(e.amount);
    return acc;
  }, {}));

  const lowStock = (products || []).filter((p) => p.stock < p.min_stock);
  const overdue = [...(customers || [])].filter((c) => c.balance > 1000).sort((a, b) => b.balance - a.balance).slice(0, 5);

  return (
    <div>
      <h2 className="font-display text-2xl font-semibold mb-0.5">How is the business doing today?</h2>
      <p className="text-slate text-sm mb-5">{new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" })} · live from Postgres</p>

      <div className="flex flex-wrap gap-3 mb-6">
        <KPI label="TODAY'S SALES" value={pkr(salesAmt)} tone="navy" sub={`${(todaySales || []).length} invoices`} />
        <KPI label="BOTTLES DELIVERED" value={bottlesDelivered} tone="aqua" />
        <KPI label="CASH COLLECTED" value={pkr(paidToday)} tone="green" />
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
        <KPI label="INVENTORY VALUE" value={pkr(inventoryValue)} tone="aqua" />
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
            <div key={p.id} className="text-xs flex gap-2"><AlertTriangle size={13} className="text-coral flex-shrink-0 mt-0.5" /><span>{p.name} is below reorder level ({p.stock}/{p.min_stock}).</span></div>
          ))}
          {overdue.map((c) => (
            <div key={c.id} className="text-xs flex gap-2"><AlertTriangle size={13} className="text-amber flex-shrink-0 mt-0.5" /><span>{c.name} has an outstanding balance of {pkr(c.balance)}.</span></div>
          ))}
          {lowStock.length + overdue.length === 0 && <p className="text-sm text-slate">No critical alerts right now.</p>}
        </div>
      </div>
    </div>
  );
}
