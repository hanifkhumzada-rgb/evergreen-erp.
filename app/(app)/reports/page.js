import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import ReportsBrowser from "@/components/ReportsBrowser";
import { getBrandingLite } from "@/lib/pdf/business";

export const dynamic = "force-dynamic";

export default async function ReportsPage({ searchParams }) {
  const sp = (await searchParams) || {};
  const supabase = await createClient();
  // Every transactional report here defaults to the last 12 months
  // instead of the business's entire history — the same reports still
  // cover everything when "All time" is picked, but a huge multi-year
  // history no longer has to hydrate into JS on every visit just to open
  // this page. Customers/products/employees/vehicles are master data
  // (not transactional), so they're never date-bound.
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

  const [
    branding,
    { data: invoices }, { data: expenses }, { data: customers }, { data: deliveries },
    { data: products }, { data: employees }, { data: balances }, { data: bottleBalances },
    { data: invoicesWithZone }, { data: payments }, { data: vehicles }, { data: fuelLogs },
    { data: maintLogs }, { data: routes }, { data: productionBatches },
  ] = await Promise.all([
    getBrandingLite(supabase),
    dateRange(supabase.from("invoices").select("*, customers(name), invoice_items(quantity)"), "invoice_date"),
    dateRange(supabase.from("expenses").select("*, expense_categories(name)"), "expense_date"),
    supabase.from("customers").select("*, zones(name), routes(name)"),
    dateRange(supabase.from("deliveries").select("*, customers(name), profiles!deliveries_rider_id_fkey(full_name), delivery_items(delivered_qty)"), "delivery_date"),
    supabase.from("products").select("*"),
    supabase.from("profiles").select("*, roles!inner(name, key)").neq("roles.key", "customer"),
    supabase.from("v_customer_balance").select("customer_id, name, balance"),
    supabase.from("v_customer_bottle_balance").select("customer_id, name, bottles_with_customer"),
    dateRange(supabase.from("invoices").select("net_amount, invoice_items(quantity), customers(name, zones(name), route_id)").neq("status", "void"), "invoice_date"),
    dateRange(supabase.from("payments").select("*, customers(name), profiles!payments_received_by_fkey(full_name)"), "payment_date"),
    supabase.from("vehicles").select("*, profiles!vehicles_assigned_rider_id_fkey(full_name)"),
    supabase.from("vehicle_fuel_logs").select("vehicle_id, cost"),
    supabase.from("vehicle_maintenance_logs").select("vehicle_id, cost"),
    supabase.from("routes").select("id, name"),
    dateRange(supabase.from("production_batches").select("*, products(name)"), "batch_date"),
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

  // Route performance — customer count, deliveries, revenue per route.
  const custByRouteId = {};
  (customers || []).forEach((c) => { if (c.route_id) custByRouteId[c.route_id] = (custByRouteId[c.route_id] || 0) + 1; });
  const deliveriesByRouteId = {};
  (deliveries || []).forEach((d) => {
    const rid = (customers || []).find((c) => c.id === d.customer_id)?.route_id;
    if (rid) deliveriesByRouteId[rid] = (deliveriesByRouteId[rid] || 0) + 1;
  });
  const revenueByRouteId = {};
  (invoicesWithZone || []).forEach((i) => {
    const rid = i.customers?.route_id;
    if (rid) revenueByRouteId[rid] = (revenueByRouteId[rid] || 0) + Number(i.net_amount);
  });
  const routeReport = (routes || []).map((r) => ({
    Route: r.name, Customers: custByRouteId[r.id] || 0, Deliveries: deliveriesByRouteId[r.id] || 0, Revenue: revenueByRouteId[r.id] || 0,
  }));

  // Employee performance — real deliveries/completed/cash, not just name+role.
  const employeePerformance = (employees || []).map((e) => {
    const d = (deliveries || []).filter((x) => x.rider_id === e.id);
    return {
      Name: e.full_name, EmployeeCode: e.employee_code, Role: e.roles?.name,
      DeliveriesAssigned: d.length, Completed: d.filter((x) => x.status === "delivered").length,
      CashCollected: d.reduce((a, x) => a + Number(x.amount_collected), 0),
    };
  });

  const fuelByVehicle = {};
  (fuelLogs || []).forEach((l) => { fuelByVehicle[l.vehicle_id] = (fuelByVehicle[l.vehicle_id] || 0) + Number(l.cost); });
  const maintByVehicle = {};
  (maintLogs || []).forEach((l) => { maintByVehicle[l.vehicle_id] = (maintByVehicle[l.vehicle_id] || 0) + Number(l.cost); });
  const fleetReport = (vehicles || []).map((v) => ({
    Vehicle: v.registration_no, Type: v.vehicle_type, Driver: v.profiles?.full_name,
    FuelCost: fuelByVehicle[v.id] || 0, MaintenanceCost: maintByVehicle[v.id] || 0,
    TotalCost: (fuelByVehicle[v.id] || 0) + (maintByVehicle[v.id] || 0), Status: v.is_active ? "Active" : "Inactive",
  }));

  const cashCollectionReport = (payments || []).map((p) => ({
    Date: p.payment_date, Customer: p.customers?.name, Amount: p.amount, Method: p.method, CollectedBy: p.profiles?.full_name || "—",
  }));

  const productionReport = (productionBatches || []).map((b) => ({
    Date: b.batch_date, Size: b.products?.name, Quantity: b.quantity_filled, CostPerBottle: b.cost_per_bottle,
    FillingCost: b.total_filling_cost, Supplier: b.supplier,
  }));

  const reports = [
    { name: "Sales Report", rows: (invoices || []).map((s) => ({ Invoice: s.invoice_no, Date: s.invoice_date, Customer: s.customers?.name, Qty: (s.invoice_items || []).reduce((a, i) => a + Number(i.quantity), 0), Total: s.net_amount, Status: s.status })) },
    { name: "Expense Report", rows: (expenses || []).map((e) => ({ Date: e.expense_date, Category: e.expense_categories?.name, Description: e.description, Amount: e.amount, Method: e.payment_method })) },
    { name: "Customer Ledger", rows: (customers || []).map((c) => ({ Customer: c.name, Balance: balanceMap[c.id] || 0, CreditLimit: c.credit_limit })) },
    { name: "Delivery Report", rows: (deliveries || []).map((d) => ({ Date: d.delivery_date, Customer: d.customers?.name, DeliveryBoy: d.profiles?.full_name, Qty: (d.delivery_items || []).reduce((a, i) => a + Number(i.delivered_qty), 0), Status: d.status })) },
    { name: "Bottle Report", rows: (customers || []).map((c) => ({ Customer: c.name, Balance: bottleMap[c.id] || 0 })) },
    { name: "Inventory Report", rows: (products || []).map(({ id, is_active, ...r }) => r) },
    { name: "Employee Performance", rows: employeePerformance },
    { name: "Receivables Report", rows: (customers || []).filter((c) => (balanceMap[c.id] || 0) > 0).map((c) => ({ Customer: c.name, Phone: c.mobile, Outstanding: balanceMap[c.id] || 0 })) },
    { name: "Customer Profitability", rows: customerProfitability },
    { name: "Area / Route Report", rows: areaReport },
    { name: "Route Performance", rows: routeReport },
    { name: "Payments / Cash Collection", rows: cashCollectionReport },
    { name: "Fleet Report", rows: fleetReport },
    { name: "Production & Filling", rows: productionReport },
  ];

  return (
    <div>
      <h2 className="font-display text-2xl font-semibold mb-1">Reports</h2>
      <p className="text-slate text-sm mb-5">
        Live Postgres data. Pick a report, export to Excel, or print to PDF.{" "}
        {allTime ? "Showing all-time history." : `Showing ${fromDate} to ${toDate}.`}
      </p>
      <form className="no-print flex flex-wrap gap-2.5 mb-4 items-center" action="/reports">
        <input type="date" name="from" defaultValue={fromDate} className="px-3 py-2 rounded-xl border border-line bg-card text-xs" />
        <span className="text-xs text-slate">to</span>
        <input type="date" name="to" defaultValue={toDate} className="px-3 py-2 rounded-xl border border-line bg-card text-xs" />
        <button type="submit" className="px-3.5 py-2 rounded-xl border border-line bg-card text-xs font-semibold">Apply</button>
        {allTime ? (
          <Link href="/reports" className="text-xs text-slate hover:text-aqua">Back to last 12 months</Link>
        ) : (
          <Link href="/reports?range=all" className="text-xs text-slate hover:text-aqua">Show all-time history instead</Link>
        )}
      </form>
      <div className="no-print flex flex-wrap gap-2 mb-5">
        <Link href="/accounting/profit-loss" className="px-3 py-1.5 rounded-lg border border-line bg-card text-xs font-semibold hover:bg-foam">Profit &amp; Loss →</Link>
        <Link href="/accounting/balance-sheet" className="px-3 py-1.5 rounded-lg border border-line bg-card text-xs font-semibold hover:bg-foam">Balance Sheet →</Link>
      </div>
      <ReportsBrowser reports={reports} branding={branding} />
    </div>
  );
}
