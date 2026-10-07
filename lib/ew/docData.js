// Server-side data loaders for EW documents. Every figure is derived from
// the underlying transactions — the customer ledger (customer_ledger_entries)
// is the single source of truth for balances, bottle_transactions for bottle
// balances. No stored/duplicated totals are trusted.
//
// Plain module (no "use client"); call only from Server Components / routes.
import { fetchAll } from "@/lib/fetchAll";

export const num = (v) => Number(v) || 0;
export const sumBy = (rows, key) => (rows || []).reduce((a, r) => a + num(r[key]), 0);

export function deliverySchedule(c) {
  if (!c) return "—";
  const parts = [];
  if (c.delivery_frequency) parts.push(String(c.delivery_frequency).replace(/_/g, " ").replace(/\b\w/g, (x) => x.toUpperCase()));
  if (Array.isArray(c.preferred_days) && c.preferred_days.length) parts.push(c.preferred_days.join(", "));
  if (c.preferred_delivery_time) parts.push(c.preferred_delivery_time);
  return parts.join(" · ") || "—";
}

export function customerAddress(c) {
  return [c?.building, c?.address, c?.area].filter(Boolean).join(", ") || "—";
}

// Ledger balance strictly BEFORE a point in time: entries on earlier dates
// plus same-date entries created earlier — minus any entries that belong
// to the excluded reference (the document itself).
// `exclude` may be one reference id or a list (an invoice generated from a
// delivery is charged through the DELIVERY's ledger entry, so both ids
// belong to the document itself).
export async function ledgerBalanceBefore(supabase, customerId, date, createdAt, exclude) {
  const excluded = new Set([].concat(exclude || []).filter(Boolean));
  if (!customerId) return 0;
  const { data } = await fetchAll(() => supabase.from("customer_ledger_entries")
    .select("id, debit, credit, reference_id, entry_date, created_at")
    .eq("customer_id", customerId)
    .lte("entry_date", date)
    .order("id"), { label: "ledger before" });
  return data
    .filter((e) => e.entry_date < date || (createdAt && e.created_at < createdAt))
    .filter((e) => !excluded.has(e.reference_id))
    .reduce((a, e) => a + num(e.debit) - num(e.credit), 0);
}

export async function currentBottleBalance(supabase, customerId) {
  if (!customerId) return 0;
  const { data } = await supabase.from("v_customer_bottle_balance").select("bottles_with_customer").eq("customer_id", customerId);
  return sumBy(data, "bottles_with_customer");
}

export async function currentLedgerBalance(supabase, customerId) {
  if (!customerId) return 0;
  const { data } = await supabase.from("v_customer_balance").select("balance").eq("customer_id", customerId).maybeSingle();
  return num(data?.balance);
}

// Payments are matched to an invoice by reference: payments entered against
// the invoice carry its invoice number; cash collected on a delivery carries
// the DELIVERY number (record_delivery_completion), so both are included.
export function invoiceRefs(invoice) {
  const d = Array.isArray(invoice?.delivery) ? invoice.delivery[0] : invoice?.delivery;
  return [invoice?.invoice_no, d?.delivery_no].filter(Boolean);
}

export async function loadInvoiceDoc(supabase, id) {
  const { data: invoice } = await supabase.from("invoices")
    .select("*, customers(*, zones(name)), invoice_items(*, products(name, size_label)), creator:profiles!invoices_created_by_fkey(full_name), delivery:deliveries(id, delivery_no, delivery_date, status, delivery_items(delivered_qty, returned_qty, unit_price, amount))")
    .eq("id", id).maybeSingle();
  if (!invoice) return null;
  const c = invoice.customers || {};
  const delivery = (Array.isArray(invoice.delivery) ? invoice.delivery[0] : invoice.delivery) || null;

  const [{ data: payments }, opening, bottleBalance] = await Promise.all([
    supabase.from("payments").select("id, receipt_no, amount, method, payment_date").eq("customer_id", c.id).in("reference", invoiceRefs(invoice)).eq("voided", false).order("payment_date"),
    ledgerBalanceBefore(supabase, c.id, invoice.invoice_date, invoice.created_at, [invoice.id, invoice.delivery_id]),
    currentBottleBalance(supabase, c.id),
  ]);

  const items = (invoice.invoice_items || []).map((it) => ({
    id: it.id,
    date: delivery?.delivery_date || invoice.invoice_date,
    description: [it.products?.name || it.description || "Water delivery", it.products?.size_label].filter(Boolean).join(" · "),
    qty: num(it.quantity),
    rate: num(it.rate),
    discount: num(it.discount),
    amount: num(it.amount),
  }));
  const paid = sumBy(payments, "amount");
  const subtotal = invoice.subtotal != null ? num(invoice.subtotal) : items.reduce((a, i) => a + i.amount, 0);
  const discount = num(invoice.discount);
  const charges = num(invoice.tax);
  const total = num(invoice.net_amount);
  const isVoid = invoice.status === "void";
  const billing = isVoid ? 0 : total;
  const outstanding = opening + billing - paid;
  const delivered = delivery ? sumBy(delivery.delivery_items, "delivered_qty") : items.reduce((a, i) => a + i.qty, 0);
  const returned = delivery ? sumBy(delivery.delivery_items, "returned_qty") : 0;

  return {
    invoice, customer: c, items, payments: payments || [], delivery,
    totals: { subtotal, discount, charges, total, paid, opening, billing, outstanding },
    bottles: { delivered, returned, balance: bottleBalance },
  };
}

export async function findInvoiceByRef(supabase, ref) {
  const { data: inv } = await supabase.from("invoices").select("id, invoice_no, invoice_date, net_amount, status").eq("invoice_no", ref).maybeSingle();
  if (inv) return inv;
  const { data: d } = await supabase.from("deliveries").select("id, delivery_no").eq("delivery_no", ref).maybeSingle();
  if (!d) return null;
  const { data: dinv } = await supabase.from("invoices").select("id, invoice_no, invoice_date, net_amount, status").eq("delivery_id", d.id).maybeSingle();
  return dinv || null;
}

export async function loadReceiptDoc(supabase, id) {
  const { data: p } = await supabase.from("payments")
    .select("*, customers(*, zones(name)), collector:profiles!payments_received_by_fkey(full_name)")
    .eq("id", id).maybeSingle();
  if (!p) return null;
  const c = p.customers || {};
  const [before, bottleBalance, invoice] = await Promise.all([
    ledgerBalanceBefore(supabase, c.id, p.payment_date, p.created_at, p.id),
    currentBottleBalance(supabase, c.id),
    p.reference ? findInvoiceByRef(supabase, p.reference) : Promise.resolve(null),
  ]);
  const amount = p.voided ? 0 : num(p.amount);
  return { payment: p, customer: c, invoice, totals: { before, amount, after: before - amount }, bottleBalance };
}

// ---------------------------------------------------------------------------
// Customer account (Statement + Ledger print)
// ---------------------------------------------------------------------------
export const LEDGER_TYPE_LABEL = {
  opening: "Opening Balance", delivery: "Delivery", delivery_void: "Delivery Reversed",
  payment: "Payment", payment_void: "Payment Reversed", invoice: "Invoice",
  invoice_void: "Invoice Reversed", invoice_adjustment: "Invoice Adjustment",
  bottle_transaction: "Bottle Movement", adjustment: "Adjustment",
  credit_note: "Credit Adjustment", debit_note: "Debit Adjustment",
};
const BILLING_TYPES = new Set(["invoice", "delivery"]);

export function monthStart(d = new Date()) {
  const s = d.toLocaleDateString("en-CA", { timeZone: "Asia/Karachi" });
  return `${s.slice(0, 7)}-01`;
}

function refOf(e) {
  const last = (e.description || "").trim().split(/\s+/).pop() || "";
  return e.smart_entries?.entry_no || (last.includes("-") ? last : "—");
}

// Loads every ledger entry of one customer (paged), walks the running
// balance chronologically, and splits it into opening (before `from`) and
// the in-period rows. Qty/Rate come from the source delivery/invoice lines.
export async function loadCustomerAccount(supabase, customerId, { from, to, withLines = false } = {}) {
  const [{ data: customer }, { data: entries }] = await Promise.all([
    supabase.from("customers").select("*, zones(name)").eq("id", customerId).maybeSingle(),
    fetchAll(() => supabase.from("customer_ledger_entries")
      .select("id, entry_date, created_at, reference_type, reference_id, description, debit, credit, bottles_out, bottles_in, remarks, smart_entries(entry_no)")
      .eq("customer_id", customerId)
      .order("entry_date", { ascending: true }).order("created_at", { ascending: true }).order("id"), { label: "customer account" }),
  ]);
  if (!customer) return null;

  // FIFO paid-status of each debit against the customer's total credits.
  const totalCreditAll = sumBy(entries, "credit");
  let pool = totalCreditAll;
  let running = 0;
  let bottles = 0;
  const all = entries.map((e) => {
    const debit = num(e.debit);
    const credit = num(e.credit);
    running += debit - credit;
    bottles += num(e.bottles_out) - num(e.bottles_in);
    let status = credit > 0 ? (e.reference_type === "payment" ? "received_payment" : "posted") : "posted";
    if ((e.reference_type || "").endsWith("_void")) status = "void";
    else if (debit > 0) {
      const consumed = Math.min(debit, Math.max(pool, 0));
      pool -= consumed;
      status = debit - consumed <= 0.01 ? "paid" : consumed > 0 ? "partial" : "sent";
    }
    return { ...e, debit, credit, bottlesOut: num(e.bottles_out), bottlesIn: num(e.bottles_in), running, bottleRunning: bottles, status, reference: refOf(e), typeLabel: LEDGER_TYPE_LABEL[e.reference_type] || (e.reference_type || "Entry") };
  });

  const before = all.filter((e) => from && e.entry_date < from);
  const inPeriod = all.filter((e) => (!from || e.entry_date >= from) && (!to || e.entry_date <= to));
  const opening = before.length ? before[before.length - 1].running : 0;
  const openingBottles = before.length ? before[before.length - 1].bottleRunning : 0;

  if (withLines && inPeriod.length) {
    const deliveryIds = inPeriod.filter((e) => e.reference_type === "delivery" && e.reference_id).map((e) => e.reference_id);
    const invoiceIds = inPeriod.filter((e) => e.reference_type === "invoice" && e.reference_id).map((e) => e.reference_id);
    const [{ data: dItems }, { data: iItems }] = await Promise.all([
      deliveryIds.length ? supabase.from("delivery_items").select("delivery_id, delivered_qty, unit_price").in("delivery_id", deliveryIds.slice(0, 500)) : Promise.resolve({ data: [] }),
      invoiceIds.length ? supabase.from("invoice_items").select("invoice_id, quantity, rate").in("invoice_id", invoiceIds.slice(0, 500)) : Promise.resolve({ data: [] }),
    ]);
    const lineMap = {};
    (dItems || []).forEach((i) => { const m = (lineMap[i.delivery_id] ||= { qty: 0, rate: 0 }); m.qty += num(i.delivered_qty); m.rate = num(i.unit_price) || m.rate; });
    (iItems || []).forEach((i) => { const m = (lineMap[i.invoice_id] ||= { qty: 0, rate: 0 }); m.qty += num(i.quantity); m.rate = num(i.rate) || m.rate; });
    inPeriod.forEach((e) => { const m = lineMap[e.reference_id]; if (m) { e.qty = m.qty; e.rate = m.rate; } });
  }

  let billing = 0, payments = 0, adjustments = 0;
  inPeriod.forEach((e) => {
    if (BILLING_TYPES.has(e.reference_type)) billing += e.debit - e.credit;
    else if (e.reference_type === "payment") payments += e.credit - e.debit;
    else if (e.reference_type === "payment_void") payments -= e.debit - e.credit;
    else adjustments += e.debit - e.credit;
  });
  const totalDebit = sumBy(inPeriod, "debit");
  const totalCredit = sumBy(inPeriod, "credit");
  const closing = opening + totalDebit - totalCredit;
  const closingBottles = openingBottles + inPeriod.reduce((a, e) => a + e.bottlesOut - e.bottlesIn, 0);

  return {
    customer, rows: inPeriod, from, to,
    totals: { opening, billing, payments, adjustments, totalDebit, totalCredit, closing, openingBottles, closingBottles,
      bottlesOut: sumBy(inPeriod, "bottlesOut"), bottlesIn: sumBy(inPeriod, "bottlesIn") },
  };
}

export async function loadClosingDoc(supabase, id) {
  const { data: closing } = await supabase.from("daily_closings")
    .select("*, closer:profiles!daily_closings_closed_by_fkey(full_name), approver:profiles!daily_closings_approved_by_fkey(full_name)")
    .eq("id", id).maybeSingle();
  if (!closing) return null;
  const { computeDaySummary } = await import("@/lib/ew/closing");
  const live = await computeDaySummary(supabase, closing.close_date);
  return { closing, live };
}

export async function loadAdjustmentDoc(supabase, id) {
  const { data: a } = await supabase.from("customer_adjustments")
    .select("*, customers(*, zones(name)), creator:profiles!customer_adjustments_created_by_fkey(full_name)")
    .eq("id", id).maybeSingle();
  if (!a) return null;
  const before = await ledgerBalanceBefore(supabase, a.customer_id, a.adjustment_date, a.created_at, a.id);
  const effect = a.status === "void" ? 0 : (a.adjustment_type === "credit" ? -1 : 1) * num(a.amount);
  return { adjustment: a, customer: a.customers || {}, before, after: before + effect };
}

// ---------------------------------------------------------------------------
// Vouchers & delivery slip
// ---------------------------------------------------------------------------
async function profileName(supabase, id) {
  if (!id) return null;
  const { data } = await supabase.from("profiles").select("full_name").eq("id", id).maybeSingle();
  return data?.full_name || null;
}

export async function loadExpenseVoucher(supabase, id) {
  const { data: e } = await supabase.from("expenses")
    .select("*, expense_categories(name), submitter:profiles!expenses_submitted_by_fkey(full_name), employee:profiles!expenses_employee_id_fkey(full_name, employee_code), zones(name), vehicles(registration_no)")
    .eq("id", id).maybeSingle();
  if (!e) return null;
  const [approver, creator] = await Promise.all([profileName(supabase, e.approved_by), profileName(supabase, e.created_by)]);
  return { expense: e, approver, creator };
}

export async function loadPurchaseVoucher(supabase, id) {
  const { data: p } = await supabase.from("purchases")
    .select("*, suppliers(*), purchase_items(quantity, rate, discount, amount, inventory_items(name, unit), products(name)), creator:profiles!purchases_created_by_fkey(full_name)")
    .eq("id", id).maybeSingle();
  if (!p) return null;
  const items = (p.purchase_items || []).map((it, i) => ({ id: i, item: it.inventory_items?.name || it.products?.name || "Item", unit: it.inventory_items?.unit || "", qty: num(it.quantity), rate: num(it.rate), discount: num(it.discount), amount: it.amount != null ? num(it.amount) : num(it.quantity) * num(it.rate) - num(it.discount) }));
  return { purchase: p, items, total: items.reduce((a, i) => a + i.amount, 0) };
}

export async function loadSalaryVoucher(supabase, id) {
  const { data: s } = await supabase.from("employee_salary_records")
    .select("*, employee:profiles!employee_salary_records_employee_id_fkey(id, full_name, employee_code, phone, joining_date, roles(name), zones(name))")
    .eq("id", id).maybeSingle();
  if (!s) return null;
  const creator = await profileName(supabase, s.created_by);
  return { salary: s, employee: s.employee || {}, creator };
}

export async function loadDeliverySlip(supabase, id) {
  const { data: d } = await supabase.from("deliveries")
    .select("*, customers(*, zones(name)), rider:profiles!deliveries_rider_id_fkey(full_name, phone), creator:profiles!deliveries_created_by_fkey(full_name), vehicles(registration_no), delivery_items(expected_qty, delivered_qty, returned_qty, unit_price, amount, products(name, size_label))")
    .eq("id", id).maybeSingle();
  if (!d) return null;
  const c = d.customers || {};
  const [{ data: invoice }, { data: payments }, bottleBalance, balance] = await Promise.all([
    supabase.from("invoices").select("id, invoice_no, status").eq("delivery_id", d.id).maybeSingle(),
    supabase.from("payments").select("id, receipt_no, amount, method").eq("reference", d.delivery_no || "").eq("voided", false),
    currentBottleBalance(supabase, c.id),
    currentLedgerBalance(supabase, c.id),
  ]);
  return { delivery: d, customer: c, invoice, payments: payments || [], collected: sumBy(payments, "amount"), bottleBalance, balance };
}
