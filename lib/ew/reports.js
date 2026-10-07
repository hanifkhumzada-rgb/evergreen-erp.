// Interactive report builders. Each returns one serialisable `spec` for
// components/ew/ReportViewer.js. Server-only (plain module, no "use client").
//
// Accuracy rules: every number is derived from the underlying transaction
// rows of the selected period (paged with fetchAll so nothing is silently
// capped at 1,000 rows); cards and the Grand Total come from the same rows
// the table shows. Heavy per-customer aggregation runs in SQL (rpc).
import { fetchAll } from "@/lib/fetchAll";
import { pkr, qty } from "@/lib/format";
import { resolveRange, periodLabel, pkToday, daysBetween } from "@/lib/ew/dates";
import { methodLabel, ageingStatus, ageingLabel } from "@/lib/ew/status";

const n = (v) => Number(v) || 0;
const sum = (rows, k) => rows.reduce((a, r) => a + n(r[k]), 0);

export const REPORTS = {
  sales: { title: "Sales Report", blurb: "Invoices, bottles, rates, collections and outstanding." },
  collections: { title: "Collection Report", blurb: "Payments received by mode, customer and collector." },
  outstanding: { title: "Outstanding Report", blurb: "Receivables with ageing and last payment." },
  expenses: { title: "Expense Report", blurb: "Spending by category with approval status." },
  deliveries: { title: "Delivery Report", blurb: "Scheduled, delivered, pending and missed deliveries." },
  bottles: { title: "Bottle Report", blurb: "Bottles with customers, filled, empty, damaged and lost." },
  inventory: { title: "Inventory Report", blurb: "Opening, stock in/out, adjustments and closing stock." },
  profit: { title: "Profit Report", blurb: "Revenue minus every cost — net profit made simple." },
  "daily-closing": { title: "Daily Closing", blurb: "Cash reconciliation, sales, collections and deliveries for a day." },
};

function inRange(q, col, { from, to }) {
  let x = q;
  if (from) x = x.gte(col, from);
  if (to) x = x.lte(col, to);
  return x;
}

function monthOptions(count = 12) {
  const t = pkToday();
  let y = +t.slice(0, 4); let m = +t.slice(5, 7);
  const out = [];
  for (let i = 0; i < count; i += 1) {
    const v = `${y}-${String(m).padStart(2, "0")}`;
    out.push({ value: v, label: new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }) });
    m -= 1; if (m === 0) { m = 12; y -= 1; }
  }
  return out;
}

// ?month=YYYY-MM overrides the date preset.
export function rangeFrom(sp, fallback = "month") {
  if (/^\d{4}-\d{2}$/.test(sp.month || "")) {
    const [y, m] = sp.month.split("-").map(Number);
    const last = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
    return { key: "custom", from: `${sp.month}-01`, to: last };
  }
  return resolveRange(sp, fallback);
}

async function lookups(supabase, { customers = false, riders = false, categories = false } = {}) {
  const [zones, cust, rid, cats] = await Promise.all([
    supabase.from("zones").select("id, name").order("name").then((r) => r.data || []),
    customers ? fetchAll(() => supabase.from("customers").select("id, code, name").order("name").order("id"), { label: "customer options" }).then((r) => r.data) : Promise.resolve([]),
    riders ? supabase.from("profiles").select("id, full_name, roles!inner(key)").in("roles.key", ["rider", "manager", "owner", "admin"]).order("full_name").then((r) => r.data || []) : Promise.resolve([]),
    categories ? supabase.from("expense_categories").select("id, name").order("name").then((r) => r.data || []) : Promise.resolve([]),
  ]);
  return {
    zone: { name: "zone", label: "Zones", options: zones.map((z) => ({ value: z.id, label: z.name })) },
    customer: { name: "customer", label: "Customers", options: cust.map((c) => ({ value: c.id, label: `${c.code ? `${c.code} · ` : ""}${c.name}` })) },
    rider: { name: "rider", label: "Delivery boys", options: rid.map((r) => ({ value: r.id, label: r.full_name })) },
    category: { name: "category", label: "Categories", options: cats.map((c) => ({ value: c.id, label: c.name })) },
    month: { name: "month", label: "Months", options: monthOptions() },
    zonesById: Object.fromEntries(zones.map((z) => [z.id, z.name])),
  };
}

function topBars(map, { limit = 8, money = true } = {}) {
  return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, limit)
    .map(([label, value]) => ({ label, value, display: money ? pkr(value) : qty(value) }));
}

function base(key, range, extra = {}) {
  return { key, title: REPORTS[key].title, period: periodLabel(range), range, updatedAt: new Date().toISOString(), ...extra };
}

// ---------------------------------------------------------------------------
// SALES
// ---------------------------------------------------------------------------
async function salesReport(supabase, sp) {
  const range = rangeFrom(sp);
  const lk = await lookups(supabase, { customers: true });
  const { data: invoices } = await fetchAll(() => {
    let q = supabase.from("invoices")
      .select("id, invoice_no, invoice_date, due_date, net_amount, status, customer_id, customers!inner(code, name, zone_id), invoice_items(quantity)")
      .neq("status", "void");
    q = inRange(q, "invoice_date", range);
    if (sp.zone) q = q.eq("customers.zone_id", sp.zone);
    if (sp.customer) q = q.eq("customer_id", sp.customer);
    return q.order("invoice_date", { ascending: false }).order("id");
  }, { label: "sales report" });

  // Payments made against these invoices (reference = invoice number).
  const paidByRef = {};
  const nos = invoices.map((i) => i.invoice_no).filter(Boolean);
  for (let i = 0; i < nos.length; i += 200) {
    const { data } = await supabase.from("payments").select("reference, amount").in("reference", nos.slice(i, i + 200)).eq("voided", false);
    (data || []).forEach((p) => { paidByRef[p.reference] = (paidByRef[p.reference] || 0) + n(p.amount); });
  }
  const today = pkToday();
  let rows = invoices.map((i) => {
    const q = sum(i.invoice_items || [], "quantity");
    const sales = n(i.net_amount);
    const paid = Math.min(paidByRef[i.invoice_no] || 0, sales);
    const outstanding = Math.max(sales - paid, 0);
    const status = outstanding <= 0.01 ? "paid" : paid > 0 ? "partial" : i.due_date && i.due_date < today ? "overdue" : "payment_due";
    return {
      _id: i.id, _kind: "invoice", date: i.invoice_date, ref: i.invoice_no, customer: i.customers?.name, code: i.customers?.code,
      zone: lk.zonesById[i.customers?.zone_id] || "—", qty: q, rate: q ? sales / q : 0, sales, paid, outstanding, status,
      _search: `${i.invoice_no} ${i.customers?.name} ${i.customers?.code}`,
    };
  });
  if (sp.status) rows = rows.filter((r) => r.status === sp.status);

  const total = sum(rows, "sales");
  const bottles = sum(rows, "qty");
  const byZone = {}; const byDay = {};
  rows.forEach((r) => { byZone[r.zone] = (byZone[r.zone] || 0) + r.sales; byDay[r.date] = (byDay[r.date] || 0) + r.sales; });
  return base("sales", range, {
    cards: [
      { label: "Total Sales", value: pkr(total), raw: total },
      { label: "Total Bottles", value: qty(bottles), raw: bottles },
      { label: "Average Rate", value: pkr(bottles ? total / bottles : 0), raw: bottles ? total / bottles : 0, sub: "per bottle" },
      { label: "Customers", value: qty(new Set(rows.map((r) => r.code || r.customer)).size), raw: new Set(rows.map((r) => r.code || r.customer)).size },
      { label: "Collected", value: pkr(sum(rows, "paid")), raw: sum(rows, "paid"), tone: "green", sub: "against these invoices" },
      { label: "Outstanding", value: pkr(sum(rows, "outstanding")), raw: sum(rows, "outstanding"), tone: "red" },
    ],
    charts: [
      { title: "Sales by Zone", items: topBars(byZone) },
      { title: "Sales by Day", items: Object.entries(byDay).sort((a, b) => (a[0] < b[0] ? 1 : -1)).slice(0, 10).map(([d, v]) => ({ label: d, value: v, display: pkr(v) })), note: "latest 10 days" },
    ],
    columns: [
      { key: "date", label: "Date", type: "date", secondary: true },
      { key: "ref", label: "Reference", primary: true },
      { key: "customer", label: "Customer" },
      { key: "zone", label: "Zone" },
      { key: "qty", label: "Qty", type: "int" },
      { key: "rate", label: "Rate", type: "money", total: false },
      { key: "sales", label: "Sales (PKR)", type: "money" },
      { key: "paid", label: "Paid (PKR)", type: "money" },
      { key: "outstanding", label: "Outstanding (PKR)", type: "money" },
      { key: "status", label: "Status", type: "status" },
    ],
    rows,
    totals: { qty: bottles, sales: total, paid: sum(rows, "paid"), outstanding: sum(rows, "outstanding") },
    filters: [lk.month, lk.zone, lk.customer, { name: "status", label: "Payment status", options: [{ value: "paid", label: "Paid" }, { value: "partial", label: "Partial" }, { value: "payment_due", label: "Payment Due" }, { value: "overdue", label: "Overdue" }] }],
    filterValues: { month: sp.month || "", zone: sp.zone || "", customer: sp.customer || "", status: sp.status || "" },
    searchPlaceholder: "Search invoice, customer, ID…",
    landscape: true,
    emptyText: "No sales invoices in this period.",
  });
}

const BUILDERS = { sales: salesReport };

export async function buildReport(key, supabase, sp) {
  const fn = BUILDERS[key];
  return fn ? fn(supabase, sp || {}) : null;
}
