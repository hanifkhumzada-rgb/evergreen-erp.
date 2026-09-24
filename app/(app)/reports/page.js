import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import ReportsBrowser from "@/components/ReportsBrowser";
import { REPORT_GROUPS } from "@/lib/reportGroups";
import { getBrandingLite } from "@/lib/pdf/business";
import { fetchAll } from "@/lib/fetchAll";

export const dynamic = "force-dynamic";

// The table shows at most this many rows; totals and the Excel export
// always cover every row in the selected range.
const DISPLAY_ROW_LIMIT = 300;

const DEFAULT_REPORT = REPORT_GROUPS[0].reports[0];
const qtySum = (items, key = "quantity") => (items || []).reduce((a, it) => a + Number(it[key] || 0), 0);

// Previously this page ran all 16 queries (including four reports the menu
// never shows) on every visit, and each transactional query was silently
// capped at 1,000 rows by the API — so a 12-month Sales or Delivery report
// would have been incomplete within weeks of real use. Now only the
// selected report's queries run, and date-ranged ones page through the
// full result (lib/fetchAll).
async function buildReport(name, supabase, dateRange) {
  const byCustomer = (rows, key) => { const m = {}; (rows || []).forEach((r) => { m[r.customer_id] = (m[r.customer_id] || 0) + Number(r[key]); }); return m; };

  switch (name) {
    case "Sales Report": {
      const { data } = await fetchAll(() => dateRange(supabase.from("invoices").select("id, invoice_no, invoice_date, net_amount, status, customers(name), invoice_items(quantity)"), "invoice_date")
        .order("invoice_date", { ascending: false }).order("id"), { label: "sales report" });
      return data.map((s) => ({ Invoice: s.invoice_no, Date: s.invoice_date, Customer: s.customers?.name, Qty: qtySum(s.invoice_items), Total: s.net_amount, Status: s.status }));
    }
    case "Customer Profitability":
    case "Area / Route Report": {
      const { data } = await fetchAll(() => dateRange(supabase.from("invoices").select("id, net_amount, invoice_items(quantity), customers(name, zones(name))").neq("status", "void"), "invoice_date")
        .order("id"), { label: "invoice revenue" });
      const groups = {};
      data.forEach((i) => {
        const key = name === "Customer Profitability" ? (i.customers?.name || "Unknown") : (i.customers?.zones?.name || "No zone");
        groups[key] = groups[key] || { revenue: 0, qty: 0 };
        groups[key].revenue += Number(i.net_amount);
        groups[key].qty += qtySum(i.invoice_items);
      });
      if (name === "Customer Profitability") {
        return Object.entries(groups).map(([Customer, v]) => ({ Customer, BottlesSold: v.qty, Revenue: v.revenue })).sort((a, b) => b.Revenue - a.Revenue);
      }
      return Object.entries(groups).map(([Zone, v]) => ({ Zone, BottlesSold: v.qty, Revenue: v.revenue }));
    }
    case "Customer Ledger":
    case "Receivables Report": {
      const [{ data: customers }, { data: balances }] = await Promise.all([
        fetchAll(() => supabase.from("customers").select("id, name, mobile, credit_limit").order("id"), { label: "customers" }),
        fetchAll(() => supabase.from("v_customer_balance").select("customer_id, balance").order("customer_id"), { label: "balances" }),
      ]);
      const balanceMap = byCustomer(balances, "balance");
      if (name === "Customer Ledger") return customers.map((c) => ({ Customer: c.name, Balance: balanceMap[c.id] || 0, CreditLimit: c.credit_limit }));
      return customers.filter((c) => (balanceMap[c.id] || 0) > 0).map((c) => ({ Customer: c.name, Phone: c.mobile, Outstanding: balanceMap[c.id] || 0 }));
    }
    case "Delivery Report": {
      const { data } = await fetchAll(() => dateRange(supabase.from("deliveries").select("id, delivery_date, status, customers(name), profiles!deliveries_rider_id_fkey(full_name), delivery_items(delivered_qty)"), "delivery_date")
        .order("delivery_date", { ascending: false }).order("id"), { label: "delivery report" });
      return data.map((d) => ({ Date: d.delivery_date, Customer: d.customers?.name, DeliveryBoy: d.profiles?.full_name, Qty: qtySum(d.delivery_items, "delivered_qty"), Status: d.status }));
    }
    case "Bottle Report": {
      const [{ data: customers }, { data: bottles }] = await Promise.all([
        fetchAll(() => supabase.from("customers").select("id, name").order("id"), { label: "customers" }),
        fetchAll(() => supabase.from("v_customer_bottle_balance").select("customer_id, product_id, bottles_with_customer").order("customer_id").order("product_id"), { label: "bottle balances" }),
      ]);
      const bottleMap = byCustomer(bottles, "bottles_with_customer");
      return customers.map((c) => ({ Customer: c.name, Balance: bottleMap[c.id] || 0 }));
    }
    case "Inventory Report": {
      const { data } = await supabase.from("products").select("*");
      return (data || []).map(({ id, is_active, ...r }) => r);
    }
    case "Expense Report": {
      const { data } = await fetchAll(() => dateRange(supabase.from("expenses").select("id, expense_date, description, amount, payment_method, expense_categories(name)"), "expense_date")
        .order("expense_date", { ascending: false }).order("id"), { label: "expense report" });
      return data.map((e) => ({ Date: e.expense_date, Category: e.expense_categories?.name, Description: e.description, Amount: e.amount, Method: e.payment_method }));
    }
    case "Employee Performance": {
      const [{ data: employees }, { data: deliveries }] = await Promise.all([
        supabase.from("profiles").select("id, full_name, employee_code, roles!inner(name, key)").neq("roles.key", "customer"),
        fetchAll(() => dateRange(supabase.from("deliveries").select("id, rider_id, status, amount_collected"), "delivery_date").order("id"), { label: "employee deliveries" }),
      ]);
      const stats = {};
      deliveries.forEach((x) => {
        const s = (stats[x.rider_id] = stats[x.rider_id] || { assigned: 0, completed: 0, cash: 0 });
        s.assigned += 1;
        if (x.status === "delivered") s.completed += 1;
        s.cash += Number(x.amount_collected);
      });
      return (employees || []).map((e) => ({
        Name: e.full_name, EmployeeCode: e.employee_code, Role: e.roles?.name,
        DeliveriesAssigned: stats[e.id]?.assigned || 0, Completed: stats[e.id]?.completed || 0, CashCollected: stats[e.id]?.cash || 0,
      }));
    }
    default:
      return [];
  }
}

export default async function ReportsPage({ searchParams }) {
  const sp = (await searchParams) || {};
  const supabase = await createClient();
  // Every transactional report here defaults to the last 12 months
  // instead of the business's entire history — the same reports still
  // cover everything when "All time" is picked. Customers/products/
  // employees are master data (not transactional), so they're never
  // date-bound.
  const allTime = sp.range === "all";
  const defaultFrom = new Date();
  defaultFrom.setFullYear(defaultFrom.getFullYear() - 1);
  const fromDate = allTime ? "" : (sp.from || defaultFrom.toISOString().slice(0, 10));
  const toDate = allTime ? "" : (sp.to || new Date().toISOString().slice(0, 10));
  const dateRange = (query, column) => {
    let q = query;
    if (fromDate) q = q.gte(column, fromDate);
    if (toDate) q = q.lte(column, toDate);
    return q;
  };

  const knownReports = REPORT_GROUPS.flatMap((g) => g.reports);
  const selected = knownReports.includes(sp.report) ? sp.report : DEFAULT_REPORT;
  const [branding, rows] = await Promise.all([getBrandingLite(supabase), buildReport(selected, supabase, dateRange)]);

  // Keep the chosen date range when switching reports.
  const baseParams = {};
  if (allTime) baseParams.range = "all";
  else {
    if (sp.from) baseParams.from = sp.from;
    if (sp.to) baseParams.to = sp.to;
  }

  return (
    <div>
      <h2 className="font-display text-2xl font-semibold mb-1">Reports</h2>
      <p className="text-slate text-sm mb-5">
        Live Postgres data. Pick a report, export to Excel, or print to PDF.{" "}
        {allTime ? "Showing all-time history." : `Showing ${fromDate} to ${toDate}.`}
      </p>
      <form className="no-print flex flex-wrap gap-2.5 mb-4 items-center" action="/reports">
        <input type="hidden" name="report" value={selected} />
        <input type="date" name="from" defaultValue={fromDate} className="px-3 py-2 rounded-xl border border-line bg-card text-xs" />
        <span className="text-xs text-slate">to</span>
        <input type="date" name="to" defaultValue={toDate} className="px-3 py-2 rounded-xl border border-line bg-card text-xs" />
        <button type="submit" className="px-3.5 py-2 rounded-xl border border-line bg-card text-xs font-semibold">Apply</button>
        {allTime ? (
          <Link href={`/reports?${new URLSearchParams({ report: selected })}`} className="text-xs text-slate hover:text-aqua">Back to last 12 months</Link>
        ) : (
          <Link href={`/reports?${new URLSearchParams({ report: selected, range: "all" })}`} className="text-xs text-slate hover:text-aqua">Show all-time history instead</Link>
        )}
      </form>
      <div className="no-print flex flex-wrap gap-2 mb-5">
        <Link href="/accounting/profit-loss" className="px-3 py-1.5 rounded-lg border border-line bg-card text-xs font-semibold hover:bg-foam">Profit &amp; Loss →</Link>
        <Link href="/accounting/balance-sheet" className="px-3 py-1.5 rounded-lg border border-line bg-card text-xs font-semibold hover:bg-foam">Balance Sheet →</Link>
      </div>
      <ReportsBrowser selected={selected} rows={rows} displayLimit={DISPLAY_ROW_LIMIT} baseParams={baseParams} branding={branding} />
    </div>
  );
}
