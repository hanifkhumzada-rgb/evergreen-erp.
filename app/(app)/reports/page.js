import { createClient } from "@/lib/supabase/server";
import ReportCard from "@/components/ReportCard";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const supabase = await createClient();
  const [
    { data: invoices }, { data: expenses }, { data: customers }, { data: deliveries },
    { data: products }, { data: employees }, { data: balances }, { data: bottleBalances },
    { data: invoicesWithZone },
  ] = await Promise.all([
    supabase.from("invoices").select("*, customers(name), invoice_items(quantity)"),
    supabase.from("expenses").select("*, expense_categories(name)"),
    supabase.from("customers").select("*, zones(name)"),
    supabase.from("deliveries").select("*, customers(name), profiles!deliveries_rider_id_fkey(full_name), delivery_items(delivered_qty)"),
    supabase.from("products").select("*"),
    supabase.from("profiles").select("*, roles!inner(name, key)").neq("roles.key", "customer"),
    supabase.from("v_customer_balance").select("customer_id, name, balance"),
    supabase.from("v_customer_bottle_balance").select("customer_id, name, bottles_with_customer"),
    supabase.from("invoices").select("net_amount, invoice_items(quantity), customers(name, zones(name))").neq("status", "void"),
  ]);

  const balanceMap = {};
  (balances || []).forEach((b) => { balanceMap[b.customer_id] = Number(b.balance); });
  const bottleMap = {};
  (bottleBalances || []).forEach((b) => { bottleMap[b.customer_id] = (bottleMap[b.customer_id] || 0) + Number(b.bottles_with_customer); });

  // Customer profitability — revenue and bottle volume per customer
  const custRevenue = {};
  (invoicesWithZone || []).forEach((i) => {
    const name = i.customers?.name || "Unknown";
    const qty = (i.invoice_items || []).reduce((a, it) => a + Number(it.quantity), 0);
    custRevenue[name] = custRevenue[name] || { revenue: 0, qty: 0 };
    custRevenue[name].revenue += Number(i.net_amount);
    custRevenue[name].qty += qty;
  });
  const customerProfitability = Object.entries(custRevenue)
    .map(([Customer, v]) => ({ Customer, BottlesSold: v.qty, Revenue: v.revenue }))
    .sort((a, b) => b.Revenue - a.Revenue);

  // Area/Route report — revenue and customer count by zone
  const zoneRevenue = {};
  (invoicesWithZone || []).forEach((i) => {
    const zoneName = i.customers?.zones?.name || "No zone";
    const qty = (i.invoice_items || []).reduce((a, it) => a + Number(it.quantity), 0);
    zoneRevenue[zoneName] = zoneRevenue[zoneName] || { revenue: 0, qty: 0 };
    zoneRevenue[zoneName].revenue += Number(i.net_amount);
    zoneRevenue[zoneName].qty += qty;
  });
  const areaReport = Object.entries(zoneRevenue).map(([Zone, v]) => ({ Zone, BottlesSold: v.qty, Revenue: v.revenue }));

  const reports = [
    { name: "Sales Report", rows: (invoices || []).map((s) => ({ Invoice: s.invoice_no, Date: s.invoice_date, Customer: s.customers?.name, Qty: (s.invoice_items || []).reduce((a, i) => a + Number(i.quantity), 0), Total: s.net_amount, Status: s.status })) },
    { name: "Expense Report", rows: (expenses || []).map((e) => ({ Date: e.expense_date, Category: e.expense_categories?.name, Description: e.description, Amount: e.amount, Method: e.payment_method })) },
    { name: "Customer Ledger", rows: (customers || []).map((c) => ({ Customer: c.name, Balance: balanceMap[c.id] || 0, CreditLimit: c.credit_limit })) },
    { name: "Delivery Report", rows: (deliveries || []).map((d) => ({ Date: d.delivery_date, Customer: d.customers?.name, DeliveryBoy: d.profiles?.full_name, Qty: (d.delivery_items || []).reduce((a, i) => a + Number(i.delivered_qty), 0), Status: d.status })) },
    { name: "Bottle Report", rows: (customers || []).map((c) => ({ Customer: c.name, Balance: bottleMap[c.id] || 0 })) },
    { name: "Inventory Report", rows: (products || []).map(({ id, is_active, ...r }) => r) },
    { name: "Employee Performance", rows: (employees || []).map((e) => ({ Name: e.full_name, Role: e.roles?.name, EmployeeCode: e.employee_code })) },
    { name: "Receivables Report", rows: (customers || []).filter((c) => (balanceMap[c.id] || 0) > 0).map((c) => ({ Customer: c.name, Phone: c.mobile, Outstanding: balanceMap[c.id] || 0 })) },
    { name: "Customer Profitability", rows: customerProfitability },
    { name: "Area / Route Report", rows: areaReport },
  ];

  return (
    <div>
      <h2 className="font-display text-2xl font-semibold mb-1">Reports</h2>
      <p className="text-slate text-sm mb-5">Live Postgres data. Export to Excel, or print to PDF.</p>
      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))" }}>
        {reports.map((r) => <ReportCard key={r.name} name={r.name} rows={r.rows} />)}
      </div>
    </div>
  );
}
