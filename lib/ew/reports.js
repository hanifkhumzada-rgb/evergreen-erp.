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
import { invoiceRefs } from "@/lib/ew/docData";

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
    riders ? supabase.from("profiles").select("id, full_name, roles!inner(key)").neq("roles.key", "customer").order("full_name").then((r) => r.data || []) : Promise.resolve([]),
    categories ? supabase.from("expense_categories").select("id, name").order("name").then((r) => r.data || []) : Promise.resolve([]),
  ]);
  return {
    zone: { name: "zone", label: "Zones", options: zones.map((z) => ({ value: z.id, label: z.name })) },
    customer: { name: "customer", label: "Customers", options: cust.map((c) => ({ value: c.id, label: `${c.code ? `${c.code} · ` : ""}${c.name}` })) },
    rider: { name: "rider", label: "Employees", options: rid.map((r) => ({ value: r.id, label: r.full_name })) },
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
      .select("id, invoice_no, invoice_date, due_date, net_amount, status, customer_id, customers!inner(code, name, zone_id), invoice_items(quantity), delivery:deliveries(delivery_no)")
      .neq("status", "void");
    q = inRange(q, "invoice_date", range);
    if (sp.zone) q = q.eq("customers.zone_id", sp.zone);
    if (sp.customer) q = q.eq("customer_id", sp.customer);
    return q.order("invoice_date", { ascending: false }).order("id");
  }, { label: "sales report" });

  // Payments made against these invoices (reference = invoice number, or
  // the delivery number for cash collected on delivery).
  const paidByRef = {};
  const nos = invoices.flatMap((i) => invoiceRefs(i));
  for (let i = 0; i < nos.length; i += 200) {
    const { data } = await supabase.from("payments").select("reference, amount").in("reference", nos.slice(i, i + 200)).eq("voided", false);
    (data || []).forEach((p) => { paidByRef[p.reference] = (paidByRef[p.reference] || 0) + n(p.amount); });
  }
  const today = pkToday();
  let rows = invoices.map((i) => {
    const q = sum(i.invoice_items || [], "quantity");
    const sales = n(i.net_amount);
    const paid = Math.min(invoiceRefs(i).reduce((a, r) => a + (paidByRef[r] || 0), 0), sales);
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

// ---------------------------------------------------------------------------
// Expense grouping (Expense, Profit and Daily Closing reports). Categories
// are business-defined, so they are grouped by name.
// ---------------------------------------------------------------------------
export const EXPENSE_GROUPS = [
  ["filling", "Filling Cost", /fill|bottle purchase|\bcaps?\b|packag|production|chemical|raw material/i],
  ["fuel", "Fuel", /fuel|petrol|diesel/i],
  ["wages", "Wages", /wage|labou?r|salar/i],
  ["rent", "Rent", /\brent/i],
  ["utilities", "Utilities", /electric|utilit|\bgas\b|water bill|internet|phone/i],
  ["vehicle", "Vehicle Maintenance", /vehicle/i],
];
export function expenseGroup(name) {
  const hit = EXPENSE_GROUPS.find(([, , re]) => re.test(name || ""));
  return hit ? hit[0] : "other";
}
export const EXPENSE_GROUP_LABEL = { ...Object.fromEntries(EXPENSE_GROUPS.map(([k, l]) => [k, l])), other: "Other Expenses" };

const METHOD_OPTIONS = ["cash", "bank", "easypaisa", "jazzcash", "online_transfer", "other"].map((m) => ({ value: m, label: methodLabel(m) }));

// ---------------------------------------------------------------------------
// COLLECTIONS
// ---------------------------------------------------------------------------
async function collectionsReport(supabase, sp) {
  const range = rangeFrom(sp);
  const lk = await lookups(supabase, { customers: true, riders: true });
  const { data } = await fetchAll(() => {
    let q = supabase.from("payments")
      .select("id, receipt_no, payment_date, amount, method, reference, voided, customer_id, received_by, customers!inner(code, name, zone_id), collector:profiles!payments_received_by_fkey(full_name)");
    q = inRange(q, "payment_date", range);
    q = sp.status === "void" ? q.eq("voided", true) : q.eq("voided", false);
    if (sp.zone) q = q.eq("customers.zone_id", sp.zone);
    if (sp.customer) q = q.eq("customer_id", sp.customer);
    if (sp.mode) q = q.eq("method", sp.mode);
    if (sp.rider) q = q.eq("received_by", sp.rider);
    return q.order("payment_date", { ascending: false }).order("id");
  }, { label: "collections report" });
  const rows = data.map((p) => ({
    _id: p.id, _kind: "payment", date: p.payment_date, ref: p.receipt_no || "—", customer: p.customers?.name, zone: lk.zonesById[p.customers?.zone_id] || "—",
    amount: n(p.amount), mode: methodLabel(p.method), method: p.method, reference: p.reference || "—", collector: p.collector?.full_name || "—", status: p.voided ? "void" : "paid",
    _search: `${p.receipt_no} ${p.customers?.name} ${p.customers?.code} ${p.reference || ""}`,
  }));
  const by = (m) => rows.filter((r) => m.includes(r.method)).reduce((a, r) => a + r.amount, 0);
  const total = sum(rows, "amount");
  const byMode = {}; const byCollector = {};
  rows.forEach((r) => { byMode[r.mode] = (byMode[r.mode] || 0) + r.amount; byCollector[r.collector] = (byCollector[r.collector] || 0) + r.amount; });
  return base("collections", range, {
    cards: [
      { label: "Total Collection", value: pkr(total), raw: total, sub: `${rows.length} receipts` },
      { label: "Cash", value: pkr(by(["cash"])), raw: by(["cash"]), tone: "green" },
      { label: "Bank", value: pkr(by(["bank", "online_transfer"])), raw: by(["bank", "online_transfer"]), tone: "blue", sub: "incl. online transfer" },
      { label: "Easypaisa", value: pkr(by(["easypaisa"])), raw: by(["easypaisa"]) },
      { label: "JazzCash", value: pkr(by(["jazzcash"])), raw: by(["jazzcash"]) },
      { label: "Other", value: pkr(by(["other"])), raw: by(["other"]) },
    ],
    charts: [{ title: "Collection by Mode", items: topBars(byMode) }, { title: "Collection by Collector", items: topBars(byCollector) }],
    columns: [
      { key: "date", label: "Date", type: "date", secondary: true },
      { key: "ref", label: "Receipt #", primary: true },
      { key: "customer", label: "Customer" },
      { key: "amount", label: "Amount (PKR)", type: "money" },
      { key: "mode", label: "Mode" },
      { key: "reference", label: "Reference" },
      { key: "collector", label: "Collected By" },
      { key: "status", label: "Status", type: "status" },
    ],
    rows, totals: { amount: total },
    filters: [lk.month, lk.zone, lk.customer, { name: "mode", label: "Payment modes", options: METHOD_OPTIONS }, { ...lk.rider, label: "Collectors" }, { name: "status", label: "Status", options: [{ value: "void", label: "Voided only" }] }],
    filterValues: { month: sp.month || "", zone: sp.zone || "", customer: sp.customer || "", mode: sp.mode || "", rider: sp.rider || "", status: sp.status || "" },
    searchPlaceholder: "Search receipt, customer, reference…",
    emptyText: "No payments received in this period.",
  });
}

// ---------------------------------------------------------------------------
// OUTSTANDING (as at today — receivables are a balance, not a period)
// ---------------------------------------------------------------------------
async function outstandingReport(supabase, sp) {
  const today = pkToday();
  const range = { key: "today", from: "", to: today };
  const lk = await lookups(supabase);
  const { data } = await supabase.rpc("fn_report_outstanding");
  let rows = (data || []).filter((c) => n(c.balance) > 0).map((c) => {
    const since = c.last_payment_date || c.first_debit_date;
    const days = since ? daysBetween(since, today) : null;
    return {
      _id: c.customer_id, _kind: "customer", code: c.code || "—", customer: c.name, zone: lk.zonesById[c.zone_id] || "—", zone_id: c.zone_id, phone: c.mobile || "—",
      lastPayment: c.last_payment_date, outstanding: n(c.balance), ageing: c.last_payment_date ? ageingLabel(days) : `No payment (${ageingLabel(days)})`, days, status: ageingStatus(c.balance, days),
      _search: `${c.code} ${c.name} ${c.mobile}`,
    };
  });
  if (sp.zone) rows = rows.filter((r) => r.zone_id === sp.zone);
  if (sp.status) rows = rows.filter((r) => r.status === sp.status);
  rows.sort((a, b) => b.outstanding - a.outstanding);
  const total = sum(rows, "outstanding");
  const amt = (st) => rows.filter((r) => st.includes(r.status)).reduce((a, r) => a + r.outstanding, 0);
  const buckets = { "0–30 days": 0, "31–60 days": 0, "61–90 days": 0, "90+ days": 0 };
  rows.forEach((r) => { buckets[r.days === null || r.days > 90 ? "90+ days" : r.days > 60 ? "61–90 days" : r.days > 30 ? "31–60 days" : "0–30 days"] += r.outstanding; });
  return {
    key: "outstanding", title: REPORTS.outstanding.title, period: `As at ${periodLabel({ from: today, to: today })}`, range, updatedAt: new Date().toISOString(), presets: false,
    cards: [
      { label: "Total Outstanding", value: pkr(total), raw: total },
      { label: "Customers Due", value: qty(rows.length), raw: rows.length },
      { label: "Overdue Customers", value: qty(rows.filter((r) => ["overdue", "critical"].includes(r.status)).length), raw: rows.filter((r) => ["overdue", "critical"].includes(r.status)).length, tone: "red", sub: pkr(amt(["overdue", "critical"])) },
      { label: "Current Due", value: pkr(amt(["current"])), raw: amt(["current"]), tone: "green", sub: "paid within 30 days" },
    ],
    charts: [{ title: "Outstanding by Ageing", items: Object.entries(buckets).map(([label, value]) => ({ label, value, display: pkr(value) })), note: "days since last payment" }],
    columns: [
      { key: "code", label: "Customer ID", secondary: true },
      { key: "customer", label: "Customer", primary: true },
      { key: "zone", label: "Zone" },
      { key: "phone", label: "Phone" },
      { key: "lastPayment", label: "Last Payment", type: "date" },
      { key: "outstanding", label: "Outstanding (PKR)", type: "money" },
      { key: "ageing", label: "Ageing" },
      { key: "status", label: "Status", type: "status" },
    ],
    rows, totals: { outstanding: total },
    filters: [lk.zone, { name: "status", label: "Statuses", options: [{ value: "current", label: "Current" }, { value: "payment_due", label: "Payment Due" }, { value: "overdue", label: "Overdue" }, { value: "critical", label: "Critical" }] }],
    filterValues: { zone: sp.zone || "", status: sp.status || "" },
    searchPlaceholder: "Search customer, ID, phone…",
    emptyText: "No customer has an outstanding balance.",
    note: "Ageing counts days since the customer's last payment (or since their first unpaid bill if they have never paid): Current ≤ 30 days · Payment Due 31–60 · Overdue 61–90 · Critical 90+.",
  };
}

// ---------------------------------------------------------------------------
// EXPENSES
// ---------------------------------------------------------------------------
async function expensesReport(supabase, sp) {
  const range = rangeFrom(sp);
  const lk = await lookups(supabase, { categories: true });
  const { data } = await fetchAll(() => {
    let q = supabase.from("expenses")
      .select("id, expense_no, expense_date, description, amount, payment_method, status, voided, category_id, expense_categories(name), submitter:profiles!expenses_submitted_by_fkey(full_name)");
    q = inRange(q, "expense_date", range);
    q = sp.status === "void" ? q.or("voided.eq.true,status.eq.void") : q.eq("voided", false).neq("status", "void");
    if (sp.status && sp.status !== "void") q = q.eq("status", sp.status);
    if (sp.category) q = q.eq("category_id", sp.category);
    if (sp.mode) q = q.eq("payment_method", sp.mode);
    return q.order("expense_date", { ascending: false }).order("id");
  }, { label: "expense report" });
  const rows = data.map((e) => ({
    _id: e.id, _kind: "expense", date: e.expense_date, ref: e.expense_no || "—", category: e.expense_categories?.name || "Uncategorised", group: expenseGroup(e.expense_categories?.name),
    description: e.description || "—", amount: n(e.amount), mode: methodLabel(e.payment_method), enteredBy: e.submitter?.full_name || "—", status: e.voided ? "void" : e.status,
    _search: `${e.expense_no} ${e.description} ${e.expense_categories?.name}`,
  }));
  const total = sum(rows, "amount");
  const g = (k) => rows.filter((r) => r.group === k).reduce((a, r) => a + r.amount, 0);
  const byCat = {};
  rows.forEach((r) => { byCat[r.category] = (byCat[r.category] || 0) + r.amount; });
  const otherTotal = total - g("filling") - g("fuel") - g("wages");
  return base("expenses", range, {
    cards: [
      { label: "Total Expense", value: pkr(total), raw: total, sub: `${rows.length} entries` },
      { label: "Filling", value: pkr(g("filling")), raw: g("filling"), tone: "blue" },
      { label: "Fuel", value: pkr(g("fuel")), raw: g("fuel"), tone: "orange" },
      { label: "Wages", value: pkr(g("wages")), raw: g("wages") },
      { label: "Other Expenses", value: pkr(otherTotal), raw: otherTotal },
    ],
    charts: [{ title: "Expense by Category", items: topBars(byCat, { limit: 14 }) }],
    columns: [
      { key: "date", label: "Date", type: "date", secondary: true },
      { key: "ref", label: "Expense #", primary: true },
      { key: "category", label: "Category" },
      { key: "description", label: "Description" },
      { key: "amount", label: "Amount (PKR)", type: "money" },
      { key: "mode", label: "Payment Mode" },
      { key: "enteredBy", label: "Entered By" },
      { key: "status", label: "Approval Status", type: "status" },
    ],
    rows, totals: { amount: total },
    filters: [lk.month, lk.category, { name: "mode", label: "Payment modes", options: METHOD_OPTIONS },
      { name: "status", label: "Statuses", options: [{ value: "draft", label: "Draft" }, { value: "submitted", label: "Pending" }, { value: "approved", label: "Approved" }, { value: "paid", label: "Paid" }, { value: "rejected", label: "Rejected" }, { value: "void", label: "Voided" }] }],
    filterValues: { month: sp.month || "", category: sp.category || "", mode: sp.mode || "", status: sp.status || "" },
    searchPlaceholder: "Search expense #, description, category…",
    emptyText: "No expenses recorded in this period.",
    note: "Filling = filling materials (bottle purchase, caps, packaging, production); Wages = labour and salaries. Totals include every non-void expense in the period — the Profit report counts approved/paid expenses only.",
  });
}

// ---------------------------------------------------------------------------
// DELIVERIES
// ---------------------------------------------------------------------------
const PENDING_STATES = ["pending", "assigned", "out_for_delivery", "rescheduled"];
const MISSED_STATES = ["missed", "customer_not_available", "cancelled"];
async function deliveriesReport(supabase, sp) {
  const range = rangeFrom(sp);
  const lk = await lookups(supabase, { riders: true });
  const { data } = await fetchAll(() => {
    let q = supabase.from("deliveries")
      .select("id, delivery_no, delivery_date, status, amount, rider_id, customer_id, customers!inner(code, name, zone_id), rider:profiles!deliveries_rider_id_fkey(full_name), delivery_items(delivered_qty, expected_qty, unit_price)")
      .neq("status", "void");
    q = inRange(q, "delivery_date", range);
    if (sp.zone) q = q.eq("customers.zone_id", sp.zone);
    if (sp.rider) q = q.eq("rider_id", sp.rider);
    if (sp.status === "pending") q = q.in("status", PENDING_STATES);
    else if (sp.status === "missed") q = q.in("status", MISSED_STATES);
    else if (sp.status) q = q.eq("status", sp.status);
    return q.order("delivery_date", { ascending: false }).order("id");
  }, { label: "delivery report" });
  const rows = data.map((d) => {
    const items = d.delivery_items || [];
    const done = ["delivered", "partially_delivered"].includes(d.status);
    const q = done ? sum(items, "delivered_qty") : sum(items, "expected_qty");
    return {
      _id: d.id, _kind: "delivery", date: d.delivery_date, ref: d.delivery_no || "—", customer: d.customers?.name, zone: lk.zonesById[d.customers?.zone_id] || "—",
      qty: q, rate: n(items[0]?.unit_price), amount: n(d.amount), rider: d.rider?.full_name || "Unassigned", status: d.status,
      _search: `${d.delivery_no} ${d.customers?.name} ${d.customers?.code} ${d.rider?.full_name || ""}`,
    };
  });
  const count = (st) => rows.filter((r) => st.includes(r.status)).length;
  const delivered = rows.filter((r) => ["delivered", "partially_delivered"].includes(r.status));
  const bottles = sum(delivered, "qty");
  const byZone = {}; const byRider = {};
  delivered.forEach((r) => { byZone[r.zone] = (byZone[r.zone] || 0) + r.qty; byRider[r.rider] = (byRider[r.rider] || 0) + r.qty; });
  return base("deliveries", range, {
    cards: [
      { label: "Scheduled", value: qty(rows.length), raw: rows.length, sub: "deliveries in period" },
      { label: "Delivered", value: qty(delivered.length), raw: delivered.length, tone: "green" },
      { label: "Pending", value: qty(count(PENDING_STATES)), raw: count(PENDING_STATES), tone: "orange" },
      { label: "Missed", value: qty(count(MISSED_STATES)), raw: count(MISSED_STATES), tone: "red" },
      { label: "Total Bottles", value: qty(bottles), raw: bottles, sub: "delivered" },
    ],
    charts: [{ title: "Bottles by Zone", items: topBars(byZone, { money: false }) }, { title: "Bottles by Delivery Boy", items: topBars(byRider, { money: false }) }],
    columns: [
      { key: "date", label: "Date", type: "date", secondary: true },
      { key: "ref", label: "Delivery #", primary: true },
      { key: "customer", label: "Customer" },
      { key: "zone", label: "Zone" },
      { key: "qty", label: "Qty", type: "int" },
      { key: "rate", label: "Rate", type: "money", total: false },
      { key: "amount", label: "Amount (PKR)", type: "money" },
      { key: "rider", label: "Delivery Boy" },
      { key: "status", label: "Status", type: "status" },
    ],
    rows, totals: { qty: sum(rows, "qty"), amount: sum(rows, "amount") },
    filters: [lk.month, lk.zone, { ...lk.rider, label: "Delivery boys" }, { name: "status", label: "Statuses", options: [{ value: "delivered", label: "Delivered" }, { value: "pending", label: "Pending" }, { value: "missed", label: "Missed / Not available" }] }],
    filterValues: { month: sp.month || "", zone: sp.zone || "", rider: sp.rider || "", status: sp.status || "" },
    searchPlaceholder: "Search delivery #, customer, delivery boy…",
    landscape: true,
    emptyText: "No deliveries scheduled in this period.",
    note: "Qty shows delivered bottles for completed deliveries and scheduled bottles for the rest. Total Bottles counts delivered bottles only.",
  });
}

// ---------------------------------------------------------------------------
// BOTTLES
// ---------------------------------------------------------------------------
async function bottlesReport(supabase, sp) {
  const range = rangeFrom(sp);
  const lk = await lookups(supabase);
  const [{ data: states }, { data: perCustomer }] = await Promise.all([
    supabase.from("v_bottle_state_summary").select("state, quantity"),
    supabase.rpc("fn_report_bottles", { p_from: range.from || null, p_to: range.to || null }),
  ]);
  const st = {};
  (states || []).forEach((s) => { st[s.state] = (st[s.state] || 0) + n(s.quantity); });
  const total = Object.entries(st).filter(([k]) => !["adjustment"].includes(k)).reduce((a, [, v]) => a + v, 0);
  let rows = (perCustomer || []).map((c) => {
    const bal = n(c.balance);
    const status = bal < 0 ? "mismatch" : c.bottle_limit && bal > c.bottle_limit ? "over_limit" : bal === 0 ? "clear" : "normal";
    return {
      _id: c.customer_id, _kind: "customer", customer: c.name, code: c.code || "—", zone: lk.zonesById[c.zone_id] || "—", zone_id: c.zone_id,
      issued: n(c.issued), returned: n(c.returned), adjustment: n(c.adjustment), balance: bal, lastActivity: c.last_activity, status,
      _search: `${c.code} ${c.name}`,
    };
  }).filter((r) => r.issued || r.returned || r.adjustment || r.balance);
  if (sp.zone) rows = rows.filter((r) => r.zone_id === sp.zone);
  if (sp.status) rows = rows.filter((r) => r.status === sp.status);
  rows.sort((a, b) => b.balance - a.balance);
  const mismatch = rows.filter((r) => ["mismatch", "over_limit"].includes(r.status)).length;
  return base("bottles", range, {
    cards: [
      { label: "Total Bottles", value: qty(total), raw: total, sub: "all bottle assets" },
      { label: "With Customers", value: qty(st.with_customer || 0), raw: st.with_customer || 0, tone: "blue" },
      { label: "Filled", value: qty(st.filled || 0), raw: st.filled || 0, tone: "green" },
      { label: "Empty", value: qty((st.warehouse || 0) + (st.returned || 0)), raw: (st.warehouse || 0) + (st.returned || 0), sub: "warehouse + returned" },
      { label: "Damaged", value: qty(st.damaged || 0), raw: st.damaged || 0, tone: "orange" },
      { label: "Lost", value: qty(st.lost || 0), raw: st.lost || 0, tone: "red" },
      { label: "Mismatch", value: qty(mismatch), raw: mismatch, tone: "red", sub: "negative or over limit" },
    ],
    charts: [{ title: "Bottles by State (now)", items: [["With customers", st.with_customer], ["With riders", st.with_rider], ["Filled", st.filled], ["Empty / warehouse", (st.warehouse || 0) + (st.returned || 0)], ["Damaged", st.damaged], ["Lost", st.lost], ["Under repair", st.under_repair]].filter(([, v]) => n(v)).map(([label, v]) => ({ label, value: n(v), display: qty(v) })) }],
    columns: [
      { key: "customer", label: "Customer", primary: true },
      { key: "code", label: "Customer ID", secondary: true },
      { key: "issued", label: "Bottles Issued", type: "int" },
      { key: "returned", label: "Empty Returned", type: "int" },
      { key: "adjustment", label: "Adjustment", type: "int" },
      { key: "balance", label: "Current Balance", type: "int" },
      { key: "lastActivity", label: "Last Activity", type: "date" },
      { key: "status", label: "Status", type: "status" },
    ],
    rows, totals: { issued: sum(rows, "issued"), returned: sum(rows, "returned"), adjustment: sum(rows, "adjustment"), balance: sum(rows, "balance") },
    filters: [lk.month, lk.zone, { name: "status", label: "Statuses", options: [{ value: "normal", label: "Normal" }, { value: "clear", label: "Clear" }, { value: "over_limit", label: "Over Limit" }, { value: "mismatch", label: "Mismatch" }] }],
    filterValues: { month: sp.month || "", zone: sp.zone || "", status: sp.status || "" },
    searchPlaceholder: "Search customer or ID…",
    emptyText: "No bottle movement with customers in this period.",
    note: "Issued / Returned / Adjustment are for the selected period; Current Balance is bottles with the customer at the end of the period. Summary cards show bottle stock right now.",
  });
}

// ---------------------------------------------------------------------------
// INVENTORY
// ---------------------------------------------------------------------------
async function inventoryReport(supabase, sp) {
  const range = rangeFrom(sp);
  const { data } = await supabase.rpc("fn_report_inventory", { p_from: range.from || null, p_to: range.to || null });
  let rows = (data || []).map((i) => {
    const closing = n(i.closing);
    const status = closing <= 0 ? "out_of_stock" : closing <= n(i.reorder_level) ? "low_stock" : "normal";
    return { _id: i.item_id, _kind: "inventory_item", item: i.name, category: i.category || "—", opening: n(i.opening), stockIn: n(i.stock_in), stockOut: n(i.stock_out), adjustment: n(i.adjustment), closing, unit: i.unit || "—", status, _search: `${i.name} ${i.category}` };
  });
  if (sp.status) rows = rows.filter((r) => r.status === sp.status);
  const low = rows.filter((r) => r.status !== "normal").length;
  return base("inventory", range, {
    cards: [
      { label: "Opening Stock", value: qty(sum(rows, "opening")), raw: sum(rows, "opening") },
      { label: "Purchased / In", value: qty(sum(rows, "stockIn")), raw: sum(rows, "stockIn"), tone: "green" },
      { label: "Used / Issued", value: qty(sum(rows, "stockOut")), raw: sum(rows, "stockOut"), tone: "orange" },
      { label: "Closing Stock", value: qty(sum(rows, "closing")), raw: sum(rows, "closing"), tone: "blue" },
      { label: "Low Stock Items", value: qty(low), raw: low, tone: "red", sub: "at or below reorder level" },
    ],
    charts: [{ title: "Closing Stock by Item", items: rows.map((r) => ({ label: r.item, value: r.closing, display: `${qty(r.closing)} ${r.unit}` })) }],
    columns: [
      { key: "item", label: "Item", primary: true },
      { key: "category", label: "Category", secondary: true, print: false },
      { key: "opening", label: "Opening", type: "number" },
      { key: "stockIn", label: "Stock In", type: "number" },
      { key: "stockOut", label: "Stock Out", type: "number" },
      { key: "adjustment", label: "Adjustment", type: "number" },
      { key: "closing", label: "Closing", type: "number" },
      { key: "unit", label: "Unit" },
      { key: "status", label: "Status", type: "status" },
    ],
    rows, totals: { opening: sum(rows, "opening"), stockIn: sum(rows, "stockIn"), stockOut: sum(rows, "stockOut"), adjustment: sum(rows, "adjustment"), closing: sum(rows, "closing") },
    filters: [lk_month(), { name: "status", label: "Statuses", options: [{ value: "normal", label: "Normal" }, { value: "low_stock", label: "Low Stock" }, { value: "out_of_stock", label: "Out of Stock" }] }],
    filterValues: { month: sp.month || "", status: sp.status || "" },
    searchPlaceholder: "Search item…",
    emptyText: "No inventory items set up.",
  });
}
function lk_month() { return { name: "month", label: "Months", options: monthOptions() }; }

// ---------------------------------------------------------------------------
// PROFIT
// ---------------------------------------------------------------------------
function bucketKey(date, view) {
  if (view === "monthly") return date.slice(0, 7);
  if (view === "weekly") {
    const d = new Date(`${date}T00:00:00Z`);
    const dow = (d.getUTCDay() + 6) % 7;
    d.setUTCDate(d.getUTCDate() - dow);
    return `Week of ${d.toISOString().slice(0, 10)}`;
  }
  return date;
}
async function profitReport(supabase, sp) {
  const range = rangeFrom(sp);
  const view = ["daily", "weekly", "monthly"].includes(sp.view) ? sp.view : "daily";
  const [{ data: inv }, { data: exp }] = await Promise.all([
    fetchAll(() => inRange(supabase.from("invoices").select("id, invoice_date, net_amount").neq("status", "void"), "invoice_date", range).order("id"), { label: "profit revenue" }),
    fetchAll(() => inRange(supabase.from("expenses").select("id, expense_date, amount, expense_categories(name)").in("status", ["approved", "paid"]).eq("voided", false), "expense_date", range).order("id"), { label: "profit expenses" }),
  ]);
  const groups = ["filling", "fuel", "wages", "rent", "utilities", "vehicle", "other"];
  const buckets = {};
  const add = (key, field, v) => { const b = (buckets[key] ||= { period: key, revenue: 0, ...Object.fromEntries(groups.map((g) => [g, 0])) }); b[field] += v; };
  inv.forEach((i) => add(bucketKey(i.invoice_date, view), "revenue", n(i.net_amount)));
  exp.forEach((e) => add(bucketKey(e.expense_date, view), expenseGroup(e.expense_categories?.name), n(e.amount)));
  const rows = Object.values(buckets).sort((a, b) => (a.period < b.period ? 1 : -1)).map((b) => {
    const cost = groups.reduce((a, g) => a + b[g], 0);
    return { ...b, _id: b.period, cost, net: b.revenue - cost, label: view === "monthly" ? new Date(`${b.period}-01T00:00:00Z`).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }) : b.period };
  });
  const T = Object.fromEntries(["revenue", ...groups, "cost", "net"].map((k) => [k, sum(rows, k)]));
  const margin = T.revenue ? (T.net / T.revenue) * 100 : 0;
  const statement = [["Revenue", T.revenue, "rev"], ...groups.map((g) => [`− ${EXPENSE_GROUP_LABEL[g]}`, T[g], "exp"]), ["NET PROFIT", T.net, "net"]];
  return base("profit", range, {
    cards: [
      { label: "Revenue", value: pkr(T.revenue), raw: T.revenue, sub: `${inv.length} invoices` },
      { label: "Total Costs", value: pkr(T.cost), raw: T.cost, tone: "orange", sub: `${exp.length} approved expenses` },
      { label: "Net Profit", value: pkr(T.net), raw: T.net, tone: T.net >= 0 ? "green" : "red" },
      { label: "Profit Margin", value: `${margin.toFixed(1)}%`, raw: margin },
    ],
    statement: statement.map(([label, value, kind]) => ({ label, value, kind })),
    columns: [
      { key: "label", label: view === "daily" ? "Date" : view === "weekly" ? "Week" : "Month", primary: true },
      { key: "revenue", label: "Revenue", type: "money" },
      { key: "filling", label: "Filling", type: "money" },
      { key: "fuel", label: "Fuel", type: "money" },
      { key: "wages", label: "Wages", type: "money" },
      { key: "rent", label: "Rent", type: "money" },
      { key: "utilities", label: "Utilities", type: "money" },
      { key: "vehicle", label: "Vehicle", type: "money" },
      { key: "other", label: "Other", type: "money" },
      { key: "net", label: "Net Profit", type: "money" },
    ],
    rows, totals: { revenue: T.revenue, filling: T.filling, fuel: T.fuel, wages: T.wages, rent: T.rent, utilities: T.utilities, vehicle: T.vehicle, other: T.other, net: T.net },
    tableTitle: `${view[0].toUpperCase()}${view.slice(1)} breakdown`,
    filters: [lk_month()],
    filterValues: { month: sp.month || "" },
    viewTabs: { name: "view", current: view, options: [["daily", "Daily"], ["weekly", "Weekly"], ["monthly", "Monthly"]] },
    landscape: true,
    excelExtra: [{ name: "Profit Statement", columns: [{ key: "label", label: "Line", type: "text" }, { key: "value", label: "Amount (PKR)", type: "money" }], rows: statement.map(([label, value]) => ({ label, value })) }],
    emptyText: "No revenue or approved expenses in this period.",
    note: "Revenue = non-void invoices dated in the period. Costs = approved or paid, non-void expenses dated in the period, grouped by category name. Pending or rejected expenses are not deducted.",
  });
}

const BUILDERS = { sales: salesReport, collections: collectionsReport, outstanding: outstandingReport, expenses: expensesReport, deliveries: deliveriesReport, bottles: bottlesReport, inventory: inventoryReport, profit: profitReport };

export async function buildReport(key, supabase, sp) {
  const fn = BUILDERS[key];
  return fn ? fn(supabase, sp || {}) : null;
}
