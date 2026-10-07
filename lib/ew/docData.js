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
export async function ledgerBalanceBefore(supabase, customerId, date, createdAt, excludeReferenceId) {
  if (!customerId) return 0;
  const { data } = await fetchAll(() => supabase.from("customer_ledger_entries")
    .select("id, debit, credit, reference_id, entry_date, created_at")
    .eq("customer_id", customerId)
    .lte("entry_date", date)
    .order("id"), { label: "ledger before" });
  return data
    .filter((e) => e.entry_date < date || (createdAt && e.created_at < createdAt))
    .filter((e) => !excludeReferenceId || e.reference_id !== excludeReferenceId)
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

export async function loadInvoiceDoc(supabase, id) {
  const { data: invoice } = await supabase.from("invoices")
    .select("*, customers(*, zones(name)), invoice_items(*, products(name, size_label)), creator:profiles!invoices_created_by_fkey(full_name)")
    .eq("id", id).maybeSingle();
  if (!invoice) return null;
  const c = invoice.customers || {};

  const [{ data: payments }, delivery, opening, bottleBalance] = await Promise.all([
    supabase.from("payments").select("id, receipt_no, amount, method, payment_date").eq("customer_id", c.id).eq("reference", invoice.invoice_no).eq("voided", false).order("payment_date"),
    invoice.delivery_id
      ? supabase.from("deliveries").select("id, delivery_no, delivery_date, status, delivery_items(delivered_qty, returned_qty, unit_price, amount, products(name, size_label))").eq("id", invoice.delivery_id).maybeSingle().then((r) => r.data)
      : Promise.resolve(null),
    ledgerBalanceBefore(supabase, c.id, invoice.invoice_date, invoice.created_at, invoice.id),
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

export async function loadReceiptDoc(supabase, id) {
  const { data: p } = await supabase.from("payments")
    .select("*, customers(*, zones(name)), collector:profiles!payments_received_by_fkey(full_name)")
    .eq("id", id).maybeSingle();
  if (!p) return null;
  const c = p.customers || {};
  const [before, bottleBalance, invoice] = await Promise.all([
    ledgerBalanceBefore(supabase, c.id, p.payment_date, p.created_at, p.id),
    currentBottleBalance(supabase, c.id),
    p.reference ? supabase.from("invoices").select("id, invoice_no, invoice_date, net_amount, status").eq("invoice_no", p.reference).maybeSingle().then((r) => r.data) : Promise.resolve(null),
  ]);
  const amount = p.voided ? 0 : num(p.amount);
  return { payment: p, customer: c, invoice, totals: { before, amount, after: before - amount }, bottleBalance };
}
