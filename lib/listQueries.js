// Filter builders shared by server-paginated list pages and their "export
// everything that matches" server actions, so the screen and the Excel
// file always apply exactly the same filter. All queries run through the
// signed-in user's Supabase client, so RLS applies to both.
import { orIlike } from "@/lib/listParams";

export const CUSTOMER_LIST_COLUMNS = "id, code, name, business_name, contact_person, mobile, alternate_phone, whatsapp_number, email, building, address, area, route, zone_id, customer_type, status, is_active, created_at, zones(name)";

export function customerFilters(sp = {}) {
  return { q: (sp.q || "").trim(), zone: sp.zone || "", status: sp.status || "", type: sp.type || "" };
}

export function applyCustomerFilters(query, f) {
  let q = query;
  if (f.zone) q = q.eq("zone_id", f.zone);
  if (f.status) q = q.eq("status", f.status);
  if (f.type) q = q.eq("customer_type", f.type);
  const or = orIlike(["code", "name", "business_name", "contact_person", "mobile", "alternate_phone", "whatsapp_number", "email", "building", "address", "area", "route"], f.q);
  if (or) q = q.or(or);
  return q;
}

export function paymentFilters(sp = {}) {
  return { q: (sp.hq || "").trim(), method: sp.method || "", from: sp.from || "", to: sp.to || "", status: sp.pstatus || "" };
}

// Payments search covers receipt/reference/notes directly; a customer
// name/code/phone match is resolved to customer ids first (customerIds).
export function applyPaymentFilters(query, f, customerIds = null) {
  let q = query;
  if (f.method) q = q.eq("method", f.method);
  if (f.from) q = q.gte("payment_date", f.from);
  if (f.to) q = q.lte("payment_date", f.to);
  if (f.status === "voided") q = q.eq("voided", true);
  if (f.status === "active") q = q.eq("voided", false);
  if (f.q) {
    const parts = [orIlike(["receipt_no", "reference", "notes"], f.q)];
    if (customerIds?.length) parts.push(`customer_id.in.(${customerIds.join(",")})`);
    q = q.or(parts.filter(Boolean).join(","));
  }
  return q;
}

export function invoiceFilters(sp = {}) {
  return { q: (sp.q || "").trim(), status: sp.status || "", from: sp.from || "", to: sp.to || "" };
}

export function applyInvoiceFilters(query, f, customerIds = null) {
  let q = query;
  if (f.status) q = q.eq("status", f.status);
  if (f.from) q = q.gte("invoice_date", f.from);
  if (f.to) q = q.lte("invoice_date", f.to);
  if (f.q) {
    const parts = [orIlike(["invoice_no"], f.q)];
    if (customerIds?.length) parts.push(`customer_id.in.(${customerIds.join(",")})`);
    q = q.or(parts.filter(Boolean).join(","));
  }
  return q;
}

export function expenseFilters(sp = {}) {
  return { q: (sp.q || "").trim(), status: sp.status || "", category: sp.category || "", from: sp.from || "", to: sp.to || "" };
}

export function applyExpenseFilters(query, f) {
  let q = query;
  if (f.status) q = q.eq("status", f.status);
  if (f.category) q = q.eq("category_id", f.category);
  if (f.from) q = q.gte("expense_date", f.from);
  if (f.to) q = q.lte("expense_date", f.to);
  const or = orIlike(["expense_no", "description", "receipt_reference"], f.q);
  if (or) q = q.or(or);
  return q;
}

export function auditFilters(sp = {}) {
  return { q: (sp.q || "").trim(), module: sp.module || "", action: sp.action || "", user: sp.user || "", from: sp.from || "", to: sp.to || "" };
}

export function applyAuditFilters(query, f) {
  let q = query;
  if (f.module) q = q.eq("module", f.module);
  if (f.action) q = q.eq("action", f.action);
  if (f.user) q = q.eq("user_id", f.user);
  if (f.from) q = q.gte("created_at", `${f.from}T00:00:00`);
  if (f.to) q = q.lte("created_at", `${f.to}T23:59:59`);
  const or = orIlike(["action", "module"], f.q);
  if (or) q = q.or(or);
  return q;
}

// Customer ids whose name/code/phone match a search term — lets list pages
// for payments/invoices/deliveries search by customer without an
// unsupported cross-table .or(). Capped: a term matching >200 customers is
// too broad to be useful as a filter and the other columns still apply.
export async function matchingCustomerIds(supabase, q) {
  const or = orIlike(["name", "code", "mobile", "business_name"], q);
  if (!or) return null;
  const { data } = await supabase.from("customers").select("id").or(or).limit(200);
  return (data || []).map((r) => r.id);
}
