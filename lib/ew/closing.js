// Daily Closing figures — ONE calculation used by the close-day action, the
// Daily Closing page, the Daily Closing Statement and the report, so the
// numbers can never disagree. Plain server module.
import { fetchAll } from "@/lib/fetchAll";

const n = (v) => Number(v) || 0;
const sum = (rows, k) => (rows || []).reduce((a, r) => a + n(r[k]), 0);
const DONE = ["delivered", "partially_delivered"];
const MISSED = ["missed", "customer_not_available", "cancelled"];

// from/to inclusive (YYYY-MM-DD). For one day pass the same date twice.
export async function computeDaySummary(supabase, from, to = from) {
  const [{ data: invoices }, { data: payments }, { data: expenses }, { data: deliveries }] = await Promise.all([
    fetchAll(() => supabase.from("invoices").select("id, net_amount").gte("invoice_date", from).lte("invoice_date", to).neq("status", "void").order("id"), { label: "closing sales" }),
    fetchAll(() => supabase.from("payments").select("id, amount, method").gte("payment_date", from).lte("payment_date", to).eq("voided", false).order("id"), { label: "closing payments" }),
    fetchAll(() => supabase.from("expenses").select("id, amount, payment_method").gte("expense_date", from).lte("expense_date", to).in("status", ["approved", "paid"]).eq("voided", false).order("id"), { label: "closing expenses" }),
    fetchAll(() => supabase.from("deliveries").select("id, status, delivery_items(delivered_qty, returned_qty)").gte("delivery_date", from).lte("delivery_date", to).neq("status", "void").order("id"), { label: "closing deliveries" }),
  ]);
  const done = deliveries.filter((d) => DONE.includes(d.status));
  return {
    sales: sum(invoices, "net_amount"),
    invoices: invoices.length,
    collections: sum(payments, "amount"),
    cashCollections: sum(payments.filter((p) => p.method === "cash"), "amount"),
    receipts: payments.length,
    expenses: sum(expenses, "amount"),
    cashExpenses: sum(expenses.filter((e) => e.payment_method === "cash"), "amount"),
    deliveries: deliveries.length,
    delivered: done.length,
    bottlesDelivered: done.reduce((a, d) => a + sum(d.delivery_items, "delivered_qty"), 0),
    emptyReturned: done.reduce((a, d) => a + sum(d.delivery_items, "returned_qty"), 0),
    missed: deliveries.filter((d) => MISSED.includes(d.status)).length,
  };
}

// Expected cash in hand = opening cash + CASH collections − CASH expenses.
// Bank / Easypaisa / JazzCash receipts never reach the cash box.
export function expectedCash(opening, s) {
  return n(opening) + n(s.cashCollections) - n(s.cashExpenses);
}

// Opening cash for a day = counted cash of the previous closing (new table
// first, then legacy cash_transactions closings), else 0.
export async function openingCashFor(supabase, date) {
  const [{ data: last }, { data: legacy }] = await Promise.all([
    supabase.from("daily_closings").select("close_date, actual_cash").lt("close_date", date).order("close_date", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("cash_transactions").select("txn_date, description").eq("reference_type", "daily_closing").lt("txn_date", date).order("txn_date", { ascending: false }).limit(1).maybeSingle(),
  ]);
  let legacyCash = null;
  if (legacy) { try { const s = JSON.parse(legacy.description); legacyCash = { date: legacy.txn_date, cash: n(s.actual_cash ?? s.expected_cash) }; } catch { /* malformed legacy row */ } }
  if (last && (!legacyCash || last.close_date >= legacyCash.date)) return n(last.actual_cash);
  return legacyCash ? legacyCash.cash : 0;
}

export function closingNo(date) {
  return `DC-${String(date).replace(/-/g, "")}`;
}
