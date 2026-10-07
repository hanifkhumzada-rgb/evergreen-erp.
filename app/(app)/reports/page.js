import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import ReportsBrowser from "@/components/ReportsBrowser";
import { REPORT_GROUPS, LEGACY_REPORT_ROUTES } from "@/lib/reportGroups";
import { redirect } from "next/navigation";
import { REPORTS } from "@/lib/ew/reports";
import { BarChart3, Wallet, AlertTriangle, Receipt, Truck, Droplets, Boxes, TrendingUp, CalendarCheck } from "lucide-react";
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

  switch (name) {
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

const REPORT_ICONS = { sales: BarChart3, collections: Wallet, outstanding: AlertTriangle, expenses: Receipt, deliveries: Truck, bottles: Droplets, inventory: Boxes, profit: TrendingUp, "daily-closing": CalendarCheck };

export default async function ReportsPage({ searchParams }) {
  const sp = (await searchParams) || {};
  if (sp.report && LEGACY_REPORT_ROUTES[sp.report]) redirect(LEGACY_REPORT_ROUTES[sp.report]);
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
  const showAnalysis = knownReports.includes(sp.report);
  const [branding, rows] = await Promise.all([getBrandingLite(supabase), showAnalysis ? buildReport(selected, supabase, dateRange) : Promise.resolve([])]);

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
      <p className="text-slate text-sm mb-5">Interactive reports from live ERP records — filter, search, open any transaction, then print, save as PDF, export to Excel or share.</p>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 mb-8">
        {Object.entries(REPORTS).map(([key, r]) => {
          const Icon = REPORT_ICONS[key] || BarChart3;
          return (
            <Link key={key} href={`/reports/${key}`} className="card-lift group flex items-start gap-3 rounded-2xl border border-line bg-card p-4">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-white" style={{ background: "linear-gradient(135deg,#0B2E59,#0A5DA8)" }}><Icon size={20} /></span>
              <span className="min-w-0">
                <span className="block font-semibold text-ink group-hover:text-aqua">{r.title}</span>
                <span className="block text-xs text-slate mt-0.5">{r.blurb}</span>
              </span>
            </Link>
          );
        })}
      </div>

      <h3 className="font-display text-lg font-semibold mb-1">More analysis</h3>
      <p className="text-slate text-sm mb-3">
        {showAnalysis ? (allTime ? "Showing all-time history." : `Showing ${fromDate} to ${toDate}.`) : "Pick an analysis table below."}
      </p>
      {showAnalysis ? (
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
      ) : null}
      <div className="no-print flex flex-wrap gap-2 mb-5">
        <Link href="/accounting/profit-loss" className="px-3 py-1.5 rounded-lg border border-line bg-card text-xs font-semibold hover:bg-foam">Profit &amp; Loss (accounting) →</Link>
        <Link href="/accounting/balance-sheet" className="px-3 py-1.5 rounded-lg border border-line bg-card text-xs font-semibold hover:bg-foam">Balance Sheet →</Link>
      </div>
      <ReportsBrowser selected={showAnalysis ? selected : ""} rows={rows} displayLimit={DISPLAY_ROW_LIMIT} baseParams={baseParams} branding={branding} />
    </div>
  );
}
