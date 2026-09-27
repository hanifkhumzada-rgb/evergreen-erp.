// Customer Portal list filters, shared by the page, its PDF and its Excel
// export so all three always show the same rows. customerId always comes
// from the signed-in session (fn_current_customer_id), never from the URL,
// and RLS scopes the rows to that customer as well.
import { ilikeTerm } from "@/lib/listParams";

const MONTH_RE = /^\d{4}-\d{2}$/;

function monthRange(month) {
  if (!MONTH_RE.test(month || "")) return null;
  const [year, monthNumber] = month.split("-").map(Number);
  return [`${month}-01`, new Date(Date.UTC(year, monthNumber, 1)).toISOString().slice(0, 10)];
}

export function portalDeliveryFilters(sp = {}) {
  const status = String(sp.status || "all");
  return {
    q: String(sp.q || "").trim().slice(0, 50),
    status: ["delivered", "pending", "cancelled", "assigned", "out_for_delivery"].includes(status) ? status : "all",
    month: MONTH_RE.test(String(sp.month || "")) ? String(sp.month) : "",
  };
}

export function portalDeliveriesQuery(supabase, customerId, f, { count = false } = {}) {
  let query = supabase.from("deliveries")
    .select("id, delivery_no, delivery_date, status, amount, delivery_items(delivered_qty, returned_qty, products(name))", count ? { count: "exact" } : undefined)
    .eq("customer_id", customerId);
  if (f.status !== "all") query = query.eq("status", f.status);
  const term = ilikeTerm(f.q);
  if (term) query = query.ilike("delivery_no", term);
  const range = monthRange(f.month);
  if (range) query = query.gte("delivery_date", range[0]).lt("delivery_date", range[1]);
  return query.order("delivery_date", { ascending: false }).order("created_at", { ascending: false }).order("id");
}

export function portalPaymentFilters(sp = {}) {
  return {
    q: String(sp.q || "").trim().slice(0, 50),
    month: MONTH_RE.test(String(sp.month || "")) ? String(sp.month) : "",
  };
}

export function portalPaymentsQuery(supabase, customerId, f, { count = false } = {}) {
  let query = supabase.from("payments")
    .select("id, receipt_no, amount, payment_date, method, reference", count ? { count: "exact" } : undefined)
    .eq("customer_id", customerId).eq("voided", false);
  const range = monthRange(f.month);
  if (range) query = query.gte("payment_date", range[0]).lt("payment_date", range[1]);
  const term = ilikeTerm(f.q);
  if (term) query = query.or(`receipt_no.ilike.${term},reference.ilike.${term}`);
  return query.order("payment_date", { ascending: false }).order("created_at", { ascending: false }).order("id");
}

export const PORTAL_METHOD_LABEL = { cash: "Cash", bank_transfer: "Bank Transfer", cheque: "Cheque", online: "Online", card: "Card" };

export function deliveryItemsText(d) {
  return (d.delivery_items || []).map((i) => `${i.products?.name || "Item"} ×${i.delivered_qty}`).join(", ");
}
