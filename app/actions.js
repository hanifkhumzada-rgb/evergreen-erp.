Warning: truncated output (original token count: 37663)
Total output lines: 2738

"use server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { REMEMBER_ME_COOKIE } from "@/lib/rememberMe";
import { sendNotification, retryNotification } from "@/lib/notifications";
import { isTwilioConfigured } from "@/lib/twilio";
import { formatAmount, statementLine } from "@/lib/reminders";
import { appOrigin } from "@/lib/appOrigin";
import { createHash, randomUUID } from "node:crypto";

async function requireUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return { supabase, user };
}

// Shared by every customer autocomplete. The database function is
// SECURITY INVOKER, tenant-scoped by RLS and returns at most 12 verified
// rows; entry screens no longer need a full customer-table request for
// every keystroke.
export async function searchCustomerSuggestions(query, limit = 12) {
  const { supabase } = await requireUser();
  const term = String(query || "").trim().slice(0, 80);
  if (term.length < 1) return { rows: [] };
  const { data, error } = await supabase.rpc("fn_customer_autocomplete", {
    p_query: term,
    p_limit: Math.min(Math.max(Number(limit) || 12, 1), 20),
  });
  if (error) return { error: error.message, rows: [] };
  return { rows: data || [] };
}

async function getUserBusinessId(supabase, userId) {
  const { data } = await supabase.from("profiles").select("business_id").eq("id", userId).maybeSingle();
  return data?.business_id || null;
}

// Fire-and-forget wrapper every delivery/payment trigger point below uses —
// sendNotification() already never throws, but this is one more layer of
// insurance around the rule that a notification failure must NEVER fail or
// roll back the actual transaction it's attached to. Always called AFTER
// the real transaction has already committed.
async function notifyBestEffort(args) {
  try { await sendNotification(args); } catch { /* best-effort — never surfaced to the caller */ }
}

// customers.manage_financial (Customer Master's opening balance / credit
// limit / special rate / discount) is restricted to owner+admin at the RLS
// grant level; customers.edit itself is broader (also manager), so these
// fields need their own app-level check before being written.
async function getUserRole(supabase, user) {
  const { data: profile } = await supabase.from("profiles").select("roles(key)").eq("id", user.id).single();
  return profile?.roles?.key;
}
const FINANCIAL_ROLES = ["owner", "admin"];

// Fallback product (19L) used when nothing more specific is available —
// Sales/Deliveries now support any active product (bottle size), resolved
// via resolveProductId below; this is only the last resort.
async function getDefaultProduct(supabase) {
  const { data } = await supabase.from("products").select("id").eq("sku", "19L").single();
  return data?.id || null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Resolves a product/bottle-size from a form (a real product id) or a bulk
// import row (a free-text size/sku like "6L"), falling back to the
// customer's own default size, then to the 19L fallback — so every existing
// caller/template that doesn't mention a size at all keeps working exactly
// as before.
async function resolveProductId(supabase, requested, fallbackProductId) {
  const val = (requested || "").toString().trim();
  if (val) {
    if (UUID_RE.test(val)) {
      const { data } = await supabase.from("products").select("id").eq("id", val).maybeSingle();
      if (data) return data.id;
    } else {
      // Commas/parentheses would change the meaning of the .or() filter.
      const safe = val.replace(/[,()*"\\]/g, " ").trim();
      const { data } = await supabase.from("products").select("id")
        .or(`sku.ilike.${safe},size_label.ilike.${safe},name.ilike.%${safe}%`)
        .limit(1).maybeSingle();
      if (data) return data.id;
    }
  }
  if (fallbackProductId) return fallbackProductId;
  return getDefaultProduct(supabase);
}

export async function globalSearch(query) {
  const q = (query || "").trim();
  if (q.length < 2) return { customers: [], invoices: [], deliveries: [], payments: [], expenses: [], employees: [], vehicles: [], workspaces: [] };
  const { supabase } = await requireUser();
  const safe = q.replace(/[^\p{L}\p{N}+\-\s]/gu, " ").replace(/\s+/g, " ").trim();
  if (safe.length < 2) return { customers: [], invoices: [], deliveries: [], payments: [], expenses: [], employees: [], vehicles: [], workspaces: [] };
  const pattern = `%${safe}%`;
  const [{ data: customers }, { data: employees }, { data: vehicles }, { data: expenses }] = await Promise.all([
    supabase.from("customers").select("id, name, mobile, code").or(`name.ilike.${pattern},mobile.ilike.${pattern},code.ilike.${pattern}`).limit(5),
    supabase.from("profiles").select("id, full_name, roles!inner(key)").neq("roles.key", "customer").ilike("full_name", pattern).limit(5),
    supabase.from("vehicles").select("id, registration_no").ilike("registration_no", pattern).limit(5),
    supabase.from("expenses").select("id,expense_no,description,receipt_reference,expense_date").or(`expense_no.ilike.${pattern},description.ilike.${pattern},receipt_reference.ilike.${pattern}`).order("expense_date", { ascending: false }).limit(5),
  ]);
  const customerIds = (customers || []).map((customer) => customer.id);
  const relatedFilter = (column) => customerIds.length
    ? `${column}.ilike.${pattern},customer_id.in.(${customerIds.join(",")})`
    : `${column}.ilike.${pattern}`;
  const [{ data: invoices }, { data: deliveries }, { data: payments }] = await Promise.all([
    supabase.from("invoices").select("id, invoice_no, customers(name)").or(relatedFilter("invoice_no")).order("invoice_date", { ascending: false }).limit(5),
    supabase.from("deliveries").select("id, delivery_no, delivery_date, customers(name)").or(relatedFilter("delivery_no")).order("delivery_date", { ascending: false }).limit(5),
    supabase.from("payments").select("id, receipt_no, customer_id, customers(name)").or(relatedFilter("receipt_no")).order("payment_date", { ascending: false }).limit(5),
  ]);
  const workspaceCatalog = [
    ["dashboard", "Owner Control Center", "/dashboard"], ["smart-entry", "Smart Entry", "/smart-entry"],
    ["reports", "Reports & Performance", "/reports"], ["profit", "Profit & Loss", "/accounting/profit-loss"],
    ["closing", "Daily Closing", "/accounting/daily-closing"], ["exceptions", "Exception Center", "/exceptions"],
    ["collections", "Payment Collection Center", "/payments"], ["routes", "Zones & Routes", "/zones"],
  ].filter(([, label]) => label.toLowerCase().includes(safe.toLowerCase())).map(([id, label, href]) => ({ id, label, href }));
  return { customers: customers || [], invoices: invoices || [], deliveries: deliveries || [], payments: payments || [], expenses: expenses || [], employees: employees || [], vehicles: vehicles || [], workspaces: workspaceCatalog };
}

async function getEffectiveRate(supabase, customerId, productId) {
  const today = new Date().toISOString().slice(0, 10);
  const { data: custPrice } = await supabase.from("customer_prices").select("price")
    .eq("customer_id", customerId).eq("product_id", productId)
    .lte("effective_from", today).or(`effective_to.is.null,effective_to.gte.${today}`)
    .order("effective_from", { ascending: false }).limit(1).maybeSingle();
  if (custPrice) return Number(custPrice.price);
  const { data: prodPrice } = await supabase.from("product_prices").select("price")
    .eq("product_id", productId)
    .lte("effective_from", today).or(`effective_to.is.null,effective_to.gte.${today}`)
    .order("effective_from", { ascending: false }).limit(1).maybeSingle();
  return Number(prodPrice?.price || 0);
}

function genCode(prefix) {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}${Math.floor(Math.random() * 36).toString(36).toUpperCase()}`;
}

async function nextDeliveryNo(supabase, customerId, deliveryDate) {
  const { data, error } = await supabase.rpc("fn_next_delivery_no", {
    p_customer_id: customerId,
    p_delivery_date: deliveryDate,
  });
  if (error || !data) throw new Error(error?.message || "Could not generate delivery reference.");
  return data;
}

// A payment only actually moves Cash/Bank balances (v_cash_account_balance)
// when cash_account_id is set — fn_post_payment_to_ledger() silently skips
// the cash_transactions insert otherwise. Pick the active account matching
// the payment method's type (bank -> bank, everything else -> cash, mirroring
// fn_journal_from_payment's own account-code choice), falling back to any
// active account if none of that type exists yet.
async function getCashAccountId(supabase, method) {
  const accountType = method === "bank" ? "bank" : "cash";
  const { data: typed } = await supabase.from("cash_accounts").select("id").eq("is_active", true).eq("type", accountType).limit(1).maybeSingle();
  if (typed) return typed.id;
  const { data: any } = await supabase.from("cash_accounts").select("id").eq("is_active", true).limit(1).maybeSingle();
  return any?.id || null;
}

// Shared by createDelivery/bulkImportDeliveries — posts a delivery's charge
// and any cash collected into the SAME ledger the DB-side
// record_delivery_completion() RPC (used by markDelivered, for pre-scheduled
// deliveries) posts to: a customer_ledger_entries debit for the charge, and
// a real payments row (never a raw cash_transactions insert) for cash
// collected so fn_post_payment_to_ledger/fn_journal_from_payment fire and
// the credit + journal entry + cash_transactions row all come from one
// source of truth. Without this, a delivery recorded through these two
// entry points never touched the customer's outstanding balance at all —
// v_customer_balance sums customer_ledger_entries only.
async function postDeliveryToLedger(supabase, { customerId, deliveryId, deliveryNo, deliveryDate, amount, cashCollected, riderId, actorId }) {
  if (amount > 0) {
    await supabase.from("customer_ledger_entries").insert({
      customer_id: customerId, entry_date: deliveryDate, reference_type: "delivery", reference_id: deliveryId,
      description: `Delivery ${deliveryNo}`, debit: amount, credit: 0, created_by: actorId,
    });
  }
  if (cashCollected > 0) {
    const { data: receiptNo } = await supabase.rpc("fn_next_receipt_no");
    await supabase.from("payments").insert({
      receipt_no: receiptNo, customer_id: customerId, amount: cashCollected, payment_date: deliveryDate,
      method: "cash", cash_account_id: await getCashAccountId(supabase, "cash"),
      received_by: riderId || actorId, reference: deliveryNo, notes: `Collected on delivery ${deliveryNo}`,
    });
  }
}

export async function signOut() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) await supabase.from("audit_logs").insert({ user_id: user.id, action: "LOGOUT", module: "auth" });
  await supabase.auth.signOut();
  // supabase.auth.signOut() clears the real session cookies regardless of
  // remember-me (createClient's setAll removal branch is untouched by that
  // flag). This clears the flag itself too, so a plain, unchecked sign-in
  // right after doesn't inherit a stale "remembered" cookie from before.
  try { (await cookies()).set(REMEMBER_ME_COOKIE, "", { path: "/", maxAge: 0 }); } catch {}
  redirect("/login");
}

// Shared by createCustomer/updateCustomer — reads every Customer Master
// field from the form. Financial fields (opening balance, credit limit,
// discount, special rate) are only included when the caller actually holds
// customers.manage_financial; anyone submitting them anyway (e.g. a
// tampered request) gets them silently dropped rather than applied.
function customerBasicsFromForm(formData) {
  const preferredDays = formData.getAll("preferred_days").filter(Boolean);
  return {
    name: formData.get("name"),
    business_name: formData.get("business_name") || null,
    contact_person: formData.get("contact_person") || null,
    mobile: formData.get("phone"),
    alternate_phone: formData.get("alternate_phone") || null,
    whatsapp_number: formData.get("whatsapp") || formData.get("phone"),
    email: formData.get("email") || null,
    customer_type: formData.get("customer_type"),
    address: formData.get("address") || "",
    building: String(formData.get("building") || "").trim() || null,
    area: formData.get("area") || null,
    zone_id: formData.get("zone_id") || null,
    route_id: formData.get("route_id") || null,
    preferred_days: preferredDays.length ? preferredDays : null,
    preferred_delivery_time: formData.get("preferred_delivery_time") || null,
    assigned_rider_id: formData.get("assigned_rider_id") || null,
    assigned_vehicle_id: formData.get("assigned_vehicle_id") || null,
    delivery_instructions: formData.get("delivery_instructions") || null,
    default_product_id: formData.get("default_product_id") || null,
    regular_qty: Number(formData.get("regular_qty")) || 0,
    payment_terms: formData.get("payment_terms") || null,
    payment_frequency: formData.get("payment_frequency") || "Monthly",
    bottle_limit: Number(formData.get("bottle_limit")) || 20,
    opening_bottles_with_customer: Number(formData.get("opening_bottles_with_customer")) || 0,
    status: formData.get("status") || "active",
    notes: formData.get("notes") || null,
  };
}

// Keeps the legacy free-text customers.route column (still read by
// DeliveryForm's search, older reports, etc.) in sync with the new
// structured route_id — so switching a customer to a real route doesn't
// silently break anything still reading the text field directly.
async function syncLegacyRouteText(supabase, payload) {
  if (!payload.route_id) return;
  const { data: route } = await supabase.from("routes").select("name").eq("id", payload.route_id).maybeSingle();
  if (route?.name) payload.route = route.name;
}

function customerFinancialsFromForm(formData) {
  return {
    credit_limit: Number(formData.get("credit_limit")) || 0,
    opening_balance: Number(formData.get("opening_balance")) || 0,
    discount_pct: Number(formData.get("discount_pct")) || 0,
  };
}

// Section 9: duplicate-customer detection on create (and, separately,
// bulk import already dedupes by mobile via BulkImportButton's
// duplicateKey mechanism). A mobile match is a near-certain duplicate; an
// exact case-insensitive name match (with a different number, e.g. a
// second line) is a softer signal — both are returned so the UI can offer
// Cancel / Use Existing / Create Anyway rather than silently blocking.
export async function checkDuplicateCustomer(mobile, name, building = "") {
  const { supabase } = await requireUser();
  const trimmedMobile = (mobile || "").toString().trim();
  const trimmedName = (name || "").toString().trim();
  const trimmedBuilding = (building || "").toString().trim();
  if (!trimmedMobile && !trimmedName) return { matches: [] };

  const [mobileResult, nameResult] = await Promise.all([
    trimmedMobile ? supabase.rpc("fn_customer_autocomplete", { p_query: trimmedMobile, p_limit: 8 }) : Promise.resolve({ data: [], error: null }),
    trimmedName ? supabase.rpc("fn_customer_autocomplete", { p_query: trimmedName, p_limit: 8 }) : Promise.resolve({ data: [], error: null }),
  ]);
  const queryError = mobileResult.error || nameResult.error;
  if (queryError) return { error: queryError.message, matches: [] };
  const byId = new Map();
  [...(mobileResult.data || []), ...(nameResult.data || [])].forEach((row) => byId.set(row.id, row));
  const normalize = (value) => String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const digits = (value) => String(value || "").replace(/\D/g, "").slice(-10);
  const phoneKey = digits(trimmedMobile);
  const nameKey = normalize(trimmedName);
  const buildingKey = normalize(trimmedBuilding);
  const data = [...byId.values()].filter((row) => {
    if (phoneKey && digits(row.mobile) === phoneKey) return true;
    const sameName = nameKey && normalize(row.name) === nameKey;
    const sameBuilding = !buildingKey || normalize(row.building || row.address).includes(buildingKey);
    return sameName && sameBuilding;
  }).slice(0, 5);

  return {
    matches: (data || []).map((c) => ({
      ...c,
      matchReason: phoneKey && digits(c.mobile) === phoneKey ? "mobile" : buildingKey ? "name + building" : "name",
    })),
  };
}

export async function createCustomer(formData) {
  const { supabase, user } = await requireUser();
  const [role, businessId] = await Promise.all([getUserRole(supabase, user), getUserBusinessId(supabase, user.id)]);
  const canManageFinancial = FINANCIAL_ROLES.includes(role);
  if (!businessId) return { error: "Your account is not assigned to a business. Ask the Owner to update your employee profile." };

  const { data: nextCode } = await supabase.rpc("fn_next_customer_code");
  const payload = {
    code: nextCode || genCode("CUST"),
    business_id: businessId,
    ...customerBasicsFromForm(formData),
    is_active: (formData.get("status") || "active") === "active",
    created_by: user.id,
  };
  if (canManageFinancial) Object.assign(payload, customerFinancialsFromForm(formData));
  await syncLegacyRouteText(supabase, payload);

  const { data: created, error } = await supabase.from("customers").insert(payload).select("id").single();
  if (error) {
    console.error("[createCustomer] customer insert failed", { code: error.code, message: error.message, userId: user.id, businessId });
    return { error: error.message };
  }

  // Special/customer rate is stored as a customer_prices override, same as
  // the standard per-product pricing — not a duplicate column on customers.
  const rate = Number(formData.get("rate"));
  if (canManageFinancial && rate > 0) {
    const productId = payload.default_product_id || (await getDefaultProduct(supabase));
    if (productId) {
      await supabase.from("customer_prices").insert({
        customer_id: created.id,
        product_id: productId,
        price: rate,
        effective_from: new Date().toISOString().slice(0, 10),
        created_by: user.id,
      });
    }
  }
  await supabase.from("audit_logs").insert({ user_id: user.id, action: "CREATE", module: "customers", record_id: created.id, new_value: { name: payload.name, mobile: payload.mobile } });
  revalidatePath("/customers");
  return { ok: true, id: created.id };
}

export async function updateCustomer(customerId, formData) {
  const { supabase, user } = await requireUser();
  const role = await getUserRole(supabase, user);
  const canManageFinancial = FINANCIAL_ROLES.includes(role);

  const payload = {
    ...customerBasicsFromForm(formData),
    is_active: (formData.get("status") || "active") === "active",
    updated_by: user.id,
    updated_at: new Date().toISOString(),
  };
  if (canManageFinancial) Object.assign(payload, customerFinancialsFromForm(formData));
  await syncLegacyRouteText(supabase, payload);

  const { error } = await supabase.from("customers").update(payload).eq("id", customerId);
  if (error) return { error: error.message };

  const rate = Number(formData.get("rate"));
  let rateChanged = false;
  if (canManageFinancial && rate > 0) {
    const productId = payload.default_product_id || (await getDefaultProduct(supabase));
    if (productId) {
      await supabase.from("customer_prices").insert({
        customer_id: customerId,
        product_id: productId,
        price: rate,
        effective_from: new Date().toISOString().slice(0, 10),
        created_by: user.id,
      });
      rateChanged = true;
    }
  }
  await supabase.from("audit_logs").insert({
    user_id: user.id, action: rateChanged ? "RATE_CHANGE" : "UPDATE", module: "customers", record_id: customerId,
    new_value: rateChanged ? { new_rate: rate } : { name: payload.name },
  });
  revalidatePath("/customers");
  revalidatePath(`/customers/${customerId}`);
  return { ok: true };
}

// Section 11: a distinct status from inactive/on_hold/blacklisted — an
// archived customer stops showing up for deliveries (is_active=false, the
// same flag deliveries/page.js already filters on) but stays fully
// visible/searchable everywhere else, with every historical record intact.
// Deliberately its own action (not just "set status via the edit form") so
// it always gets a reason and an audit log entry.
export async function archiveCustomer(customerId, reason) {
  const { supabase, user } = await requireUser();
  const trimmed = (reason || "").toString().trim();
  if (!trimmed) return { error: "A reason is required to archive a customer." };

  const { error } = await supabase.from("customers").update({ status: "archived", is_active: false }).eq("id", customerId);
  if (error) return { error: error.message };

  await supabase.from("audit_logs").insert({ user_id: user.id, action: "ARCHIVE", module: "customers", record_id: customerId, new_value: { reason: trimmed } });
  revalidatePath("/customers");
  revalidatePath(`/customers/${customerId}`);
  return { ok: true };
}

// Section 10: hard delete, gated on customers.delete. The FK from
// bottle_transactions/customer_ledger_entries/deliveries/invoices/orders/
// payments into customers is NO ACTION (verified against the schema), so
// the database itself already refuses to delete a customer with any real
// transaction history — this surfaces that (Postgres code 23503) as a
// clear "archive instead" message rather than a raw constraint error, and
// only customers with zero history (a genuine data-entry duplicate/
// mistake) can actually be removed this way.
export async function deleteCustomer(customerId, reason) {
  const { supabase, user } = await requireUser();
  const trimmed = (reason || "").toString().trim();
  if (!trimmed) return { error: "A reason is required to delete a customer." };

  const { error } = await supabase.from("customers").delete().eq("id", customerId);
  if (error) {
    if (error.code === "23503") return { error: "Can't delete — this customer has delivery, invoice, payment, or ledger history. Archive instead to keep the records but stop new activity." };
    return { error: error.message };
  }

  await supabase.from("audit_logs").insert({ user_id: user.id, action: "DELETE", module: "customers", record_id: customerId, new_value: { reason: trimmed } });
  revalidatePath("/customers");
  return { ok: true };
}

// Recurring/subscription order automation — a customer's preferred_days +
// regular_qty + default_product_id schedule can be paused (skips the daily
// cron until resumed, nothing else about the account changes), resumed, or
// cancelled (same as paused, but a deliberate "stop for good" the Owner can
// still flip back if it turns out to be premature — nothing here ever
// touches historical deliveries/invoices/payments). Relies on customers'
// existing customers.edit RLS policy the same way archiveCustomer does
// above; fn_audit_trigger (already attached to customers) logs the change
// automatically.
async function setRecurringStatus(customerId, status) {
  const { supabase, user } = await requireUser();
  const { error } = await supabase.from("customers")
    .update({ recurring_status: status, recurring_status_updated_at: new Date().toISOString(), recurring_status_updated_by: user.id })
    .eq("id", customerId);
  if (error) return { error: error.message };
  revalidatePath(`/customers/${customerId}`);
  revalidatePath("/deliveries");
  return { ok: true };
}
export async function pauseRecurringSchedule(customerId) { return setRecurringStatus(customerId, "paused"); }
export async function resumeRecurringSchedule(customerId) { return setRecurringStatus(customerId, "active"); }
export async function cancelRecurringSchedule(customerId) { return setRecurringStatus(customerId, "cancelled"); }

export async function createSale(formData) {
  const { supabase, user } = await requireUser();
  const customerId = formData.get("customer_id");
  const qty = Number(formData.get("qty"));
  const paid = Number(formData.get("paid")) || 0;

  const { data: customer } = await supabase.from("customers").select("default_product_id").eq("id", customerId).maybeSingle();
  const productId = await resolveProductId(supabase, formData.get("product_id"), customer?.default_product_id);
  if (!productId) return { error: "No product configured" };
  const { data: product } = await supabase.from("products").select("name").eq("id", productId).maybeSingle();
  const rate = await getEffectiveRate(supabase, customerId, productId);
  const total = qty * rate;

  const { data: invNo } = await supabase.rpc("fn_next_invoice_no");
  const status = paid >= total && total > 0 ? "paid" : paid > 0 ? "partially_paid" : "sent";

  const { data: invoice, error } = await supabase.from("invoices").insert({
    invoice_no: invNo,
    customer_id: customerId,
    subtotal: total,
    discount: 0,
    tax: 0,
    net_amount: total,
    status,
    created_by: user.id,
  }).select("id").single();
  if (error) return { error: error.message };

  const { error: itemErr } = await supabase.from("invoice_items").insert({
    invoice_id: invoice.id,
    product_id: productId,
    description: product?.name || "Bottle",
    quantity: qty,
    rate,
    discount: 0,
  });
  if (itemErr) return { error: itemErr.message };

  if (paid > 0) {
    const { data: receiptNo } = await supabase.rpc("fn_next_receipt_no");
    const methodMap = { Cash: "cash", "Bank Transfer": "bank", JazzCash: "jazzcash", Easypaisa: "easypaisa" };
    const method = methodMap[formData.get("payment_method")] || "cash";
    await supabase.from("payments").insert({
      receipt_no: receiptNo,
      customer_id: customerId,
      amount: paid,
      method,
      cash_account_id: await getCashAccountId(supabase, method),
      received_by: user.id,
      reference: invNo,
    });
  }

  revalidatePath("/sales");
  revalidatePath("/dashboard");
  revalidatePath("/customers");
  return { ok: true };
}

// Every report/dashboard query in this file already filters invoices with
// .neq("status", "void") — so setting status to 'void' here is enough to
// pull a voided invoice out of every revenue total with no further changes
// anywhere else. fn_void_invoice (migration 0010_financial_void_workflows)
// also reverses the customer ledger debit (if the invoice had posted one)
// and the journal entry, and refuses to void an invoice that already has
// payments applied against it — void/reverse those first.
export async function voidInvoice(invoiceId, reason) {
  const { supabase, user } = await requireUser();
  const trimmed = (reason || "").toString().trim();
  if (!trimmed) return { error: "A reason is required to void an invoice." };

  const { error } = await supabase.rpc("fn_void_invoice", { p_invoice_id: invoiceId, p_reason: trimmed });
  if (error) return { error: error.message };

  await supabase.from("audit_logs").insert({ user_id: user.id, action: "VOID", module: "invoices", record_id: invoiceId, new_value: { reason: trimmed } });
  revalidatePath("/invoices");
  revalidatePath("/sales");
  revalidatePath("/dashboard");
  revalidatePath("/customers");
  revalidatePath("/ledger");
  revalidatePath("/accounting/journal");
  return { ok: true };
}

export async function createPayment(formData) {
  const { supabase, user } = await requireUser();
  const [{ data: receiptNo }, businessId] = await Promise.all([
    supabase.rpc("fn_next_receipt_no"),
    getUserBusinessId(supabase, user.id),
  ]);
  if (!businessId) return { error: "Your account is not assigned to a business." };
  const methodMap = { Cash: "cash", "Bank Transfer": "bank", JazzCash: "jazzcash", Easypaisa: "easypaisa" };
  const method = methodMap[formData.get("method")] || "cash";
  const customerId = formData.get("customer_id");
  const amount = Number(formData.get("amount"));
  if (!customerId || !Number.isFinite(amount) || amount <= 0) return { error: "Pick a customer and enter a valid payment amount." };

  // Duplicate-submission guard — same pattern createDelivery already uses.
  // Without this, a double-tapped "Record Payment" button or a retried
  // network request inserted two separate payment rows, each posting its
  // own ledger credit (a real double-payment). Caught while verifying
  // "double-submit never creates a duplicate transaction" for real.
  const { data: recentDup } = await supabase.from("payments")
    .select("id").eq("customer_id", customerId).eq("amount", amount).eq("method", method).eq("voided", false)
    .gte("created_at", new Date(Date.now() - 20000).toISOString())
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (recentDup) return { ok: true, duplicate: true };

  const { data: payment, error } = await supabase.from("payments").insert({
    receipt_no: receiptNo,
    business_id: businessId,
    customer_id: customerId,
    amount,
    payment_date: formData.get("payment_date") || new Date().toISOString().slice(0, 10),
    method,
    cash_account_id: await getCashAccountId(supabase, method),
    received_by: formData.get("collector_id") || user.id,
    reference: formData.get("reference") || null,
    notes: formData.get("notes") || null,
  }).select("id").single();
  if (error) return { error: error.message };
  await supabase.from("audit_logs").insert({
    user_id: user.id, action: "CREATE", module: "payments",
    new_value: { customer_id: customerId, amount, method, collected_by: formData.get("collector_id") || user.id },
  });

  // Best-effort, after the payment transaction above has already fully
  // committed. automationKey gates it on the "Payment Receipt Messages"
  // row (Automation Center) being turned on.
  if (businessId) {
    const { data: custRow } = await supabase.from("customers").select("name").eq("id", customerId).maybeSingle();
    await notifyBestEffort({
      supabase, businessId, customerId, templateKey: "payment_received",
      variables: { customer_name: custRow?.name || "Customer", amount: Math.round(amount).toLocaleString("en-PK"), receipt_no: receiptNo },
      automationKey: "payment_receipts", relatedType: "payment", relatedId: payment.id,
    });
  }

  revalidatePath("/payments");
  revalidatePath("/dashboard");
  revalidatePath("/customers");
  revalidatePath("/ledger");
  return { ok: true };
}

// Payments are immutable once created (no edit) — voiding is the only way
// to correct one, and it's the only UPDATE payments' RLS allows at all
// (p_payments_update_void, gated on payments.delete). fn_void_payment
// (migration 0010_financial_void_workflows) reverses the customer ledger
// credit, the cash movement (if any), and the journal entry in one
// transaction — verified live to restore both the customer's balance and
// the cash account balance to exactly their pre-payment values.
export async function voidPayment(paymentId, reason) {
  const { supabase, user } = await requireUser();
  const trimmed = (reason || "").toString().trim();
  if (!trimmed) return { error: "A reason is required to void a payment." };

  const { error } = await supabase.rpc("fn_void_payment", { p_payment_id: paymentId, p_reason: trimmed });
  if (error) return { error: error.message };

  await supabase.from("audit_logs").insert({ user_id: user.id, action: "VOID", module: "payments", record_id: paymentId, new_value: { reason: trimmed } });
  revalidatePath("/payments");
  revalidatePath("/dashboard");
  revalidatePath("/customers");
  revalidatePath("/ledger");
  revalidatePath("/accounting/journal");
  return { ok: true };
}

// The interactive counterpart to bulkImportDeliveries: same insert shape
// (delivery -> delivery_items -> bottle_transactions -> ledger/payment),
// one row at a time from a form instead of a spreadsheet. Unlike the bulk
// path this always records rider_id — a manually-entered delivery always
// has a known responsible delivery boy. Used by both the "+ New Delivery"
// form and the Today's Deliveries workspace's per-customer Deliver sheet.
export async function createDelivery(formData) {
  const { supabase, user } = await requireUser();
  const businessId = await getUserBusinessId(supabase, user.id);
  const customerId = String(formData.get("customer_id") || "");
  const productId = String(formData.get("product_id") || "");
  const deliveredQty = Number(formData.get("delivered_qty"));
  const returnedQty = Number(formData.get("returned_qty") || 0);
  const cashCollected = Number(formData.get("cash_collected") || 0);
  const deliveryDate = String(formData.get("delivery_date") || new Date().toISOString().slice(0, 10));
  if (!customerId || !productId || !Number.isInteger(deliveredQty) || deliveredQty <= 0 || !Number.isInteger(returnedQty) || returnedQty < 0 || !Number.isFinite(cashCollected) || cashCollected < 0) {
    return { error: "Select a customer/product, positive whole delivered quantity and non-negative returns/cash." };
  }
  const { data: deliveryId, error } = await supabase.rpc("fn_record_water_delivery", {
    p_customer_id: customerId, p_product_id: productId, p_delivery_date: deliveryDate,
    p_delivered_qty: deliveredQty, p_returned_qty: returnedQty, p_cash_collected: cashCollected,
    p_rider_id: formData.get("rider_id") || user.id,
    p_request_id: String(formData.get("request_id") || randomUUID()),
  });
  if (error) return { error: error.message };
  if (businessId) {
    const { data: custRow } = await supabase.from("customers").select("name").eq("id", customerId).maybeSingle();
    await notifyBestEffort({ supabase, businessId, customerId, templateKey: "delivery_confirmation",
      variables: { customer_name: custRow?.name || "Customer", quantity: deliveredQty },
      automationKey: "delivery_messages", relatedType: "delivery", relatedId: deliveryId });
  }
  for (const path of ["/deliveries", "/bottles", "/bottle-ledger", "/dashboard", "/customers", `/customers/${customerId}`, "/ledger", "/payments", "/employees"]) revalidatePath(path);
  return { ok: true, id: deliveryId };
}

export async function correctWaterDelivery(deliveryId, items, reason) {
  const { supabase, user } = await requireUser();
  if ((await getUserRole(supabase, user)) !== "owner") return { error: "Only the Owner may correct a completed delivery." };
  const { error } = await supabase.rpc("fn_correct_water_delivery", { p_id: deliveryId, p_items: items, p_reason: String(reason || "").trim() });
  if (error) return { error: error.message };
  for (const path of ["/deliveries", "/bottles", "/bottle-ledger", "/customers", "/ledger", "/dashboard"]) revalidatePath(path);
  return { ok: true };
}

export async function correctWaterExpense(expenseId, formData) {
  const { supabase, user } = await requireUser();
  if ((await getUserRole(supabase, user)) !== "owner") return { error: "Only the Owner may correct expenses." };
  const amount = Number(formData.get("amount"));
  if (!Number.isFinite(amount) || amount <= 0) return { error: "Amount must be greater than zero." };
  const { error, data } = await supabase.rpc("fn_correct_water_expense", {
    p_id: expenseId, p_category_id: formData.get("category_id"),
    p_date: formData.get("expense_date"), p_amount: amount,
    p_method: formData.get("method") === "Bank Transfer" ? "bank" : "cash",
    p_description: String(formData.get("description") || ""),
    p_receipt: String(formData.get("receipt_reference") || ""),
    p_reason: String(formData.get("reason") || "").trim(),
  });
  if (error) return { error: error.message };
  for (const path of ["/expenses", "/dashboard", "/accounting/journal", "/accounting/profit-loss"]) revalidatePath(path);
  return { ok: true, id: data, pendingApproval: true };
}

// Expenses above the "expense_approval_threshold" automation rule post as
// "submitted" (pending Owner approval) instead of posting immediately;
// fn_journal_from_expense() only fires the journal entry once the row
// transitions to approved/paid, so a pending expense has no cash impact yet.
async function resolveExpenseStatus(supabase, amount) {
  const { data: rule } = await supabase.from("automation_rules").select("enabled, threshold_value").eq("key", "expense_approval_threshold").maybeSingle();
  if (rule?.enabled && amount > Number(rule.threshold_value)) return "submitted";
  return "approved";
}

export async function createExpense(formData) {
  const { supabase, user } = await requireUser();
  const amount = Number(formData.get("amount"));
  const businessId = await getUserBusinessId(supabase, user.id);
  const { data: permitted } = await supabase.rpc("fn_has_permission", { perm_key: "expenses.create" });
  if (!permitted || !businessId) return { error: "Expense creation permission and business assignment required." };
  if (!Number.isFinite(amount) || amount <= 0) return { error: "Expense amount must be greater than zero." };
  const categoryName = formData.get("category");
  let { data: category } = await supabase.from("expense_categories").select("id").eq("name", categoryName).maybeSingle();
  if (!category) return { error: "No expense category configured" };
  const methodMap = { Cash: "cash", "Bank Transfer": "bank" };
  const status = await resolveExpenseStatus(supabase, amount);
  const { data: expense, error } = await supabase.from("expenses").insert({
    expense_no: genCode("EXP"),
    business_id: businessId,
    category_id: category.id,
    description: formData.get("description"),
    amount,
    expense_date: formData.get("expense_date") || new Date().toISOString().slice(0, 10),
    payment_method: methodMap[formData.get("method")] || "cash",
    status,
    submitted_by: user.id,
    created_by: user.id,
    approved_by: status === "approved" ? user.id : null,
    approved_at: status === "approved" ? new Date().toISOString() : null,
    receipt_reference: formData.get("receipt_reference") || null,
  }).select("id,status").single();
  if (error) return { error: error.message };
  revalidatePath("/expenses");
  revalidatePath("/dashboard");
  return { ok: true, id: expense.id, pendingApproval: expense.status === "submitted" };
}

// Phase 5 — Production & Filling. A standalone cost record, deliberately
// not folded into the expenses table (different shape, different owner —
// a filling run has quantity/cost-per-bottle math the generic expense form
// has no fields for). total_filling_cost is a generated column on the
// table itself, so it's never out of sync with quantity * cost_per_bottle.
export async function createProductionBatch(formData) {
  const { supabase, user } = await requireUser();
  const productId = formData.get("product_id");
  const quantityFilled = Number(formData.get("quantity_filled"));
  const costPerBottle = Number(formData.get("cost_per_bottle"));
  if (!productId || !quantityFilled || quantityFilled <= 0 || costPerBottle < 0) {
    return { error: "Pick a bottle size and enter a valid quantity and cost per bottle." };
  }
  const { data: batch, error } = await supabase.from("production_batches").insert({
    batch_no: genCode("PRD"),
    batch_date: formData.get("batch_date") || new Date().toISOString().slice(0, 10),
    product_id: productId,
    quantity_filled: quantityFilled,
    cost_per_bottle: costPerBottle,
    caps_quantity: Number(formData.get("caps_quantity")) || null,
    cap_cost: Number(formData.get("cap_cost")) || null,
    other_material_cost: Number(formData.get("other_material_cost")) || 0,
    supplier: formData.get("supplier") || null,
    notes: formData.get("notes") || null,
    created_by: user.id,
  }).select("id").single();
  if (error) return { error: error.message };
  await supabase.from("audit_logs").insert({
    user_id: user.id, action: "CREATE", module: "production_batches", record_id: batch.id,
    new_value: { product_id: productId, quantity_filled: quantityFilled, cost_per_bottle: costPerBottle },
  });
  revalidatePath("/production");
  revalidatePath("/dashboard");
  revalidatePath("/reports");
  return { ok: true };
}

// production_batches has no inventory-table side effect to reverse (it's a
// standalone cost record, per the comment above) — fn_void_production_batch
// (migration 0016) just marks it voided; production/page.js excludes voided
// batches from every KPI total while still listing them.
export async function voidProductionBatch(batchId, reason) {
  const { supabase, user } = await requireUser();
  const trimmed = (reason || "").toString().trim();
  if (!trimmed) return { error: "A reason is required to void a production batch." };

  const { error } = await supabase.rpc("fn_void_production_batch", { p_batch_id: batchId, p_reason: trimmed });
  if (error) return { error: error.message };

  await supabase.from("audit_logs").insert({ user_id: user.id, action: "VOID", module: "production_batches", record_id: batchId, new_value: { reason: trimmed } });
  revalidatePath("/production");
  revalidatePath("/dashboard");
  revalidatePath("/reports");
  return { ok: true };
}

// Owner-only in the UI (Pending Approvals section on the Expenses page); RLS
// still requires expenses.edit to update the row either way.
export async function approveExpense(expenseId) {
  const { supabase, user } = await requireUser();
  const { error } = await supabase.from("expenses").update({
    status: "approved",
    approved_by: user.id,
    approved_at: new Date().toISOString(),
  }).eq("id", expenseId).eq("status", "submitted");
  if (error) return { error: error.message };
  revalidatePath("/expenses");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function rejectExpense(expenseId) {
  const { supabase, user } = await requireUser();
  const { error } = await supabase.from("expenses").update({
    status: "rejected",
    approved_by: user.id,
    approved_at: new Date().toISOString(),
  }).eq("id", expenseId).eq("status", "submitted");
  if (error) return { error: error.message };
  revalidatePath("/expenses");
  revalidatePath("/dashboard");
  return { ok: true };
}

// Financial records are never hard-deleted (see section 6-7 of the void
// workflow request) — fn_void_expense (SECURITY DEFINER, migration
// 0010_financial_void_workflows) does the whole thing atomically: checks
// expenses.delete, flips voided/void_reason, and posts a reversing journal
// entry if the expense had already been posted. RLS/the column-guard
// trigger enforce the same permission again beneath this app-level check.
export async function voidExpense(expenseId, reason) {
  const { supabase, user } = await requireUser();
  const trimmed = (reason || "").toString().trim();
  if (!trimmed) return { error: "A reason is required to void an expense." };

  const { error } = await supabase.rpc("fn_void_expense", { p_expense_id: expenseId, p_reason: trimmed });
  if (error) return { error: error.message };

  await supabase.from("audit_logs").insert({ user_id: user.id, action: "VOID", module: "expenses", record_id: expenseId, new_value: { reason: trimmed } });
  revalidatePath("/expenses");
  revalidatePath("/dashboard");
  revalidatePath("/accounting/journal");
  return { ok: true };
}

// Every journal entry in this schema is a system-generated side effect of
// an expense/payment/invoice/delivery — there's no manual journal-entry
// creation anywhere in the app. fn_void_journal_entry (migration 0017)
// refuses to touch an entry tied to one of those four source modules (void
// the source record instead — its own void action posts the correct
// reversal already) and only reverses a genuinely standalone/orphaned
// entry, by posting a new entry with every line's debit/credit swapped —
// verified live to mirror the original exactly and to correctly refuse an
// entry still tied to a live expense.
export async function voidJournalEntry(entryId, reason) {
  const { supabase, user } = await requireUser();
  const trimmed = (reason || "").toString().trim();
  if (!trimmed) return { error: "A reason is required to void a journal entry." };

  const { error } = await supabase.rpc("fn_void_journal_entry", { p_entry_id: entryId, p_reason: trimmed });
  if (error) return { error: error.message };

  await supabase.from("audit_logs").insert({ user_id: user.id, action: "VOID", module: "journal_entries", record_id: entryId, new_value: { reason: trimmed } });
  revalidatePath("/accounting/journal");
  revalidatePath("/accounting/trial-balance");
  revalidatePath("/accounting/balance-sheet");
  revalidatePath("/accounting/profit-loss");
  return { ok: true };
}

export async function markDelivered(deliveryId, deliveredQty, emptyReceived) {
  const { supabase, user } = await requireUser();
  const { data: d } = await supabase.from("deliveries").select("delivery_date, customer_id, delivery_items(product_id, expected_qty, unit_price)").eq("id", deliveryId).single();
  if (!d) return { error: "Delivery not found" };

  const items = [];
  for (const it of d.delivery_items || []) {
    const unitPrice = Number(it.unit_price) > 0 ? Number(it.unit_price) : await getEffectiveRate(supabase, d.customer_id, it.product_id);
    items.push({ product_id: it.product_id, delivered_qty: deliveredQty, returned_qty: emptyReceived, unit_price: unitPrice });
  }
  const total = items.reduce((a, it) => a + it.delivered_qty * it.unit_price, 0);

  const { error } = await supabase.rpc("record_delivery_completion", {
    p_delivery_id: deliveryId,
    p_items: items,
    p_status: "delivered",
    p_amount_collected: total,
    p_payment_method: "cash",
    p_cash_account_id: await getCashAccountId(supabase, "cash"),
  });
  if (error) return { error: error.message };

  // Best-effort, after record_delivery_completion has already fully
  // committed — same delivery_confirmation trigger as createDelivery.
  const businessId = await getUserBusinessId(supabase, user.id);
  if (businessId) {
    const { data: custRow } = await supabase.from("customers").select("name").eq("id", d.customer_id).maybeSingle();
    await notifyBestEffort({
      supabase, businessId, customerId: d.customer_id, templateKey: "delivery_confirmation",
      variables: { customer_name: custRow?.name || "Customer", quantity: deliveredQty },
      automationKey: "delivery_messages", relatedType: "delivery", relatedId: deliveryId,
    });
  }

  revalidatePath("/deliveries");
  revalidatePath("/bottles");
  revalidatePath("/bottle-ledger");
  return { ok: true };
}

// Corrects a mistakenly entered delivery (wrong quantity, wrong customer,
// accidental double-entry) — never edits the original row's numbers, only
// marks it voided and reverses everything its creation touched:
// fn_void_delivery (migration 0015_delivery_void_workflow) reverses the
// bottle_transactions movement(s), the customer_ledger_entries charge, and
// (if cash was collected on the delivery) the associated payment's own
// ledger/cash/journal impact — verified live to restore the customer
// balance, cash balance, and bottle-with-customer balance all to their
// exact pre-delivery values.
export async function voidDelivery(deliveryId, reason) {
  const { supabase, user } = await requireUser();
  const trimmed = (reason || "").toString().trim();
  if (!trimmed) return { error: "A reason is required to void a delivery." };

  const { error } = await supabase.rpc("fn_void_delivery", { p_delivery_id: deliveryId, p_reason: trimmed });
  if (error) return { error: error.message };

  await supabase.from("audit_logs").insert({ user_id: user.id, action: "VOID", module: "deliveries", record_id: deliveryId, new_value: { reason: trimmed } });
  revalidatePath("/deliveries");
  revalidatePath("/bottles");
  revalidatePath("/bottle-ledger");
  revalidatePath("/dashboard");
  revalidatePath("/customers");
  revalidatePath("/ledger");
  revalidatePath("/payments");
  revalidatePath("/accounting/journal");
  return { ok: true };
}

// For non-delivered outcomes (missed/cancelled/rescheduled/etc) — no bottle or
// cash reconciliation needed, just the status and an optional driver note.
export async function updateDeliveryStatus(deliveryId, status, note) {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("deliveries").update({
    status,
    rider_remarks: note || null,
  }).eq("id", deliveryId);
  if (error) return { error: error.message };
  revalidatePath("/deliveries");
  revalidatePath("/dashboard");
  return { ok: true };
}

// Today's Deliveries workspace — "Skip" on a customer who has no delivery
// row yet today (nothing scheduled ahead of time to update the status of,
// unlike updateDeliveryStatus above). Creates a zero-amount deliveries row
// so the card's Pending/Completed/Skipped status has something to read,
// without touching bottles, cash, or the ledger.
export async function skipTodayDelivery(customerId, note) {
  const { supabase, user } = await requireUser();
  if (!customerId) return { error: "Customer required." };
  const today = new Date().toISOString().slice(0, 10);
  const { data: existing } = await supabase.from("deliveries").select("id")
    .eq("customer_id", customerId).eq("delivery_date", today).limit(1).maybeSingle();
  if (existing) {
    const { error } = await supabase.from("deliveries").update({ status: "missed", rider_remarks: note || null }).eq("id", existing.id);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase.from("deliveries").insert({
      delivery_no: await nextDeliveryNo(supabase, customerId, today), customer_id: customerId, rider_id: user.id, delivery_date: today,
      status: "missed", amount: 0, amount_collected: 0, rider_remarks: note || null, created_by: user.id,
    });
    if (error) return { error: error.message };
  }
  revalidatePath("/deliveries");
  revalidatePath("/dashboard");
  return { ok: true };
}

// Live duty GPS tracking — called by StaffLocationTracker for an explicitly
// opted-in Delivery Boy while the app is visible. Movement and heartbeat
// thresholds are handled client-side, with a server-side 10s write guard.
// No revalidatePath: nothing on the page
// that calls this needs to re-render off the back of it — the Live
// Tracking page picks up new rows through its own Supabase Realtime
// subscription instead. RLS (p_staff_locations_insert) is the real gate
// here — user_id/business_id trust the session, not the caller's input,
// so this can't spoof another employee. The matching rider-only RLS policy
// is restored by the Smart Live Route migration.
export async function reportStaffLocation(latitude, longitude) {
  const { supabase, user } = await requireUser();
  if (typeof latitude !== "number" || typeof longitude !== "number" || Number.isNaN(latitude) || Number.isNaN(longitude)) {
    return { error: "Invalid coordinates." };
  }
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return { error: "Coordinates are outside the valid GPS range." };
  const { data: roleKey, error: roleError } = await supabase.rpc("fn_current_role_key");
  if (roleError || roleKey !== "rider") return { error: "Only an authorized Delivery Boy can share duty location." };
  // Insert (this ping) and delete (this user's points older than 24h) touch
  // disjoint rows, so they run in parallel rather than one after the other.
  const { data: latest } = await supabase.from("staff_locations").select("recorded_at").eq("user_id", user.id).order("recorded_at", { ascending: false }).limit(1).maybeSingle();
  if (latest && Date.now() - new Date(latest.recorded_at).getTime() < 10000) return { ok: true, suppressed: true };
  const [{ error }] = await Promise.all([
    supabase.from("staff_locations").insert({ user_id: user.id, latitude, longitude }),
    supabase.from("staff_locations").delete().eq("user_id", user.id).lt("recorded_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
  ]);
  if (error) return { error: error.message };
  return { ok: true };
}

// RLS on automation_rules restricts updates to fn_has_permission('settings.manage')
// (owner), so a non-owner reaching this returns the RLS error rather than silently
// succeeding.
export async function updateAutomationRule(ruleId, formData) {
  const { supabase, user } = await requireUser();
  const enabled = formData.get("enabled") === "on";
  const thresholdValue = Number(formData.get("threshold_value")) || 0;
  const patch = { enabled, threshold_value: thresholdValue, updated_by: user.id, updated_at: new Date().toISOString() };
  // Channel checkboxes only exist on a communication-category row's form
  // (AutomationCenterForm) — the alert-rule form (AutomationRulesForm)
  // never submits a "category" field, so this never touches channels for
  // an alert row.
  if (formData.get("category") === "communication") {
    patch.channel_whatsapp = formData.get("channel_whatsapp") === "on";
    patch.channel_sms = formData.get("channel_sms") === "on";
  }
  const { error } = await supabase.from("automation_rules").update(patch).eq("id", ruleId);
  if (error) return { error: error.message };
  await supabase.from("audit_logs").insert({ user_id: user.id, action: "SETTINGS_CHANGE", module: "automation_rules", record_id: ruleId, new_value: patch });
  revalidatePath("/settings");
  revalidatePath("/automation");
  return { ok: true };
}

const BRANDING_TEXT_FIELDS = [
  "business_name", "tagline", "address", "phone", "phone_2", "whatsapp_number", "email", "ntn",
  "bank_details", "payment_terms", "footer_note",
  "invoice_prefix", "receipt_prefix", "delivery_prefix", "order_prefix", "bpv_prefix",
];
const BRANDING_IMAGE_FIELDS = { logo: "logo_url", signature: "signature_url", stamp: "stamp_url" };

// The single source of truth every document generator (PDF routes, print
// headers, Excel exports) reads its letterhead from — see
// lib/pdf/business.js's getBusinessBranding(). Text fields go straight
// into business_settings; the three optional image fields are uploaded to
// the public "branding" storage bucket first (RLS on storage.objects is
// gated on the same settings.manage permission as the row update below —
// migration 0029 — so this naturally fails closed for anyone else) and
// only their resulting public URL is written to the row.
export async function updateBusinessSettings(formData) {
  const { supabase, user } = await requireUser();

  const patch = { updated_by: user.id, updated_at: new Date().toISOString() };
  for (const field of BRANDING_TEXT_FIELDS) {
    const value = formData.get(field);
    if (value !== null) patch[field] = String(value).trim() || null;
  }
  // business_name/footer_note are NOT NULL in the schema — never write an
  // empty string into them.
  if (!patch.business_name) delete patch.business_name;
  if (!patch.footer_note) patch.footer_note = "Thank you for choosing Evergreen Water — Pure Drinking Water, delivered.";

  for (const [field, column] of Object.entries(BRANDING_IMAGE_FIELDS)) {
    const file = formData.get(field);
    if (!(file instanceof File) || file.size === 0) continue;
    const ext = (file.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
    const path = `${field}-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("branding").upload(path, file, { upsert: true, contentType: file.type || "image/png" });
    if (upErr) return { error: `${field}: ${upErr.message}` };
    const { data: pub } = supabase.storage.from("branding").getPublicUrl(path);
    patch[column] = pub.publicUrl;
  }

  const { error } = await supabase.from("business_settings").update(patch).eq("id", true);
  if (error) return { error: error.message };

  await supabase.from("audit_logs").insert({ user_id: user.id, action: "SETTINGS_CHANGE", module: "business_settings", record_id: null, new_value: patch });
  revalidatePath("/settings");
  return { ok: true };
}

// Owner-controlled toggle (Automation Center) for whether the Customer
// Portal's live rider map shows at all (app/portal/(main)/page.js checks
// this before even querying staff_locations). A separate small action
// rather than folding into updateBusinessSettings above — this is a
// single boolean flipped from a checkbox, not part of the branding form.
export async function updateCustomerLiveTrackingSetting(enabled) {
  const { supabase, user } = await requireUser();
  const { error } = await supabase.from("business_settings").update({ customer_live_tracking_enabled: enabled }).eq("id", true);
  if (error) return { error: error.message };
  await supabase.from("audit_logs").insert({ user_id: user.id, action: "SETTINGS_CHANGE", module: "business_settings", record_id: null, new_value: { customer_live_tracking_enabled: enabled } });
  revalidatePath("/automation");
  return { ok: true };
}

// NOTE: the live schema has no `daily_closings` table (this accounting
// feature was dropped from the newer schema). To keep the Daily Closing page
// working without altering the database schema, each closing is recorded as
// a `cash_transactions` row (type "adjustment", reference_type
// "daily_closing") on the default cash account, with the reconciliation
// figures packed into `description` as JSON so the history table can still
// show them. This is a best-effort workaround, not a real accounting table.
export async function closeDay(formData) {
  const { supabase, user } = await requireUser();
  const closeDate = formData.get("close_date");
  const openingCash = Number(formData.get("opening_cash")) || 0;
  const actualCash = Number(formData.get("actual_cash"));
  const differenceReason = String(formData.get("difference_reason") || "").trim();

  const { data: invoices } = await supabase.from("invoices").select("net_amount").eq("invoice_date", closeDate).neq("status", "void");
  const { data: payments } = await supabase.from("payments").select("amount").eq("payment_date", closeDate).eq("voided", false);
  const { data: expenses } = await supabase.from("expenses").select("amount").eq("expense_date", closeDate).in("status", ["approved", "paid"]);

  const salesTotal = (invoices || []).reduce((a, s) => a + Number(s.net_amount), 0);
  const collectionsTotal = (payments || []).reduce((a, p) => a + Number(p.amount), 0);
  const expensesTotal = (expenses || []).reduce((a, e) => a + Number(e.amount), 0);
  const expectedCash = openingCash + collectionsTotal - expensesTotal;
  const difference = actualCash - expectedCash;
  if (Math.abs(difference) >= 1 && differenceReason.length < 5) return { error: "Explain the cash difference before closing the day." };

  const { data: cashAccount } = await supabase.from("cash_accounts").select("id").eq("is_active", true).limit(1).maybeSingle();
  if (!cashAccount) return { error: "No cash account configured" };

  const summary = JSON.stringify({ close_date: closeDate, opening_cash: openingCash, collections_total: collectionsTotal, expenses_total: expensesTotal, expected_cash: expectedCash, actual_cash: actualCash, difference, difference_reason: differenceReason || null, status: "closed" });
  const { error } = await supabase.from("cash_transactions").insert({
    account_id: cashAccount.id,
    txn_date: closeDate,
    type: "adjustment",
    amount: difference,
    reference_type: "daily_closing",
    description: summary,
    created_by: user.id,
  });
  if (error) return { error: error.message };

  await supabase.from("audit_logs").insert({ user_id: user.id, action: "CLOSE_DAY", module: "cash_transactions", new_value: { close_date: closeDate, difference, difference_reason: differenceReason || null } });
  revalidatePath("/accounting/daily-closing");
  return { ok: true, difference, expectedCash };
}

export async function addVehicle(formData) {
  const { supabase } = aw…7663 tokens truncated…Customers(supabase, 30),
    supabase.from("automation_rules").select("threshold_value").eq("business_id", businessId).eq("key", "customer_inactive").maybeSingle(),
    supabase.from("zones").select("id, name").eq("business_id", businessId),
    supabase.from("invoices").select("net_amount, customers(zone_id)").eq("business_id", businessId).neq("status", "void").eq("invoice_date", today),
    supabase.from("invoices").select("net_amount, customers(zone_id)").eq("business_id", businessId).neq("status", "void").gte("invoice_date", avgFrom).lt("invoice_date", today),
    supabase.from("customers").select("id, name, zone_id").eq("business_id", businessId).eq("is_active", true),
  ]);

  // customers.created_at::date isn't filterable via the query builder the
  // same way as the other calls above (no operator for a cast-then-eq), so
  // it's computed with a plain range instead, same as every other
  // "today" filter in this function.
  const { count: newCustomers } = await supabase.from("customers").select("id", { count: "exact", head: true })
    .eq("business_id", businessId).gte("created_at", `${today}T00:00:00`).lt("created_at", `${today}T23:59:59.999`);

  const deliveredToday = (todaysDeliveries || []).length;
  const salesToday = (todaysInvoices || []).reduce((a, i) => a + Number(i.net_amount), 0);
  const collectionToday = (todaysPayments || []).reduce((a, p) => a + Number(p.amount), 0);
  const dueToday = (dueTodayInvoices || []).length;
  const overdueCount = overdue.length;
  const overdueTotal = overdue.reduce((a, c) => a + c.amount, 0);

  // Sales vs normal — average daily sales over the trailing 30 days
  // (excluding today, which is still accumulating), same trailing-average
  // technique the sales forecast askAI answer already uses.
  const avgDailySales = (avgInvoices || []).length ? (avgInvoices || []).reduce((a, i) => a + Number(i.net_amount), 0) / 30 : 0;
  const salesVsNormalPct = avgDailySales > 0 ? Math.round(((salesToday - avgDailySales) / avgDailySales) * 100) : null;

  // Weakest zone — today's collection (invoiced revenue, same figure the
  // rest of the app calls "sales") per zone vs that zone's own trailing
  // 30-day daily average. Only flagged when the zone has a real average to
  // compare against and today is meaningfully behind it (avoids flagging a
  // zone that simply has no deliveries scheduled today).
  const zoneNameById = {};
  (zonesRaw || []).forEach((z) => { zoneNameById[z.id] = z.name; });
  const zoneOfCustomer = {};
  (customersWithZone || []).forEach((c) => { zoneOfCustomer[c.id] = c.zone_id; });
  const sumByZone = (rows) => {
    const m = {};
    (rows || []).forEach((r) => {
      const zoneId = r.customers?.zone_id;
      if (!zoneId) return;
      m[zoneId] = (m[zoneId] || 0) + Number(r.net_amount);
    });
    return m;
  };
  const zoneToday = sumByZone(zoneInvoicesToday);
  const zoneAvg30 = sumByZone(zoneInvoicesAvg);
  let weakZone = null;
  Object.keys(zoneAvg30).forEach((zoneId) => {
    const avgDaily = zoneAvg30[zoneId] / 30;
    if (avgDaily < 500) return; // too small a zone for "today vs average" to mean anything
    const todayAmt = zoneToday[zoneId] || 0;
    const ratio = todayAmt / avgDaily;
    if (ratio < 0.5 && (!weakZone || ratio < weakZone.ratio)) {
      weakZone = { name: zoneNameById[zoneId] || "Unknown zone", ratio };
    }
  });

  // At-risk-of-inactive — active, has ordered before, but hasn't in a
  // while: between half the customer_inactive threshold and the threshold
  // itself. Past the threshold, they're already the "inactive_customer"
  // alert's problem, not this "still time to act" one.
  const inactiveDays = Number(inactiveRule?.threshold_value) || 15;
  const warnFrom = daysAgoISO(inactiveDays);
  const warnSince = daysAgoISO(Math.floor(inactiveDays / 2));
  const { data: recentOrderers } = await supabase.from("invoices").select("customer_id").eq("business_id", businessId).neq("status", "void").gte("invoice_date", warnFrom);
  const orderedSince = new Set((recentOrderers || []).map((i) => i.customer_id));
  const { data: recentlyOrdered } = await supabase.from("invoices").select("customer_id").eq("business_id", businessId).neq("status", "void").gte("invoice_date", warnSince);
  const orderedRecently = new Set((recentlyOrdered || []).map((i) => i.customer_id));
  const atRiskCount = (customersWithZone || []).filter((c) => orderedSince.has(c.id) && !orderedRecently.has(c.id)).length;

  const factLines = [
    `${deliveredToday} deliveries, ${pkrFmt(salesToday)} sales, ${pkrFmt(collectionToday)} collected so far today.`,
    `${dueToday} customers due today, ${overdueCount} overdue (${pkrFmt(overdueTotal)}).`,
  ];
  if (newCustomers) factLines.push(`${newCustomers} new customer${newCustomers === 1 ? "" : "s"} today.`);

  const clauses = [];
  if (salesVsNormalPct !== null && Math.abs(salesVsNormalPct) >= 5) {
    clauses.push(`Sales are ${Math.abs(salesVsNormalPct)}% ${salesVsNormalPct < 0 ? "below" : "above"} normal today`);
  }
  if (overdueCount > 0) clauses.push(`${overdueCount} customer${overdueCount === 1 ? " is" : "s are"} overdue`);
  if (weakZone) clauses.push(`${weakZone.name} collection is weak`);
  if (atRiskCount > 0) clauses.push(`${atRiskCount} customer${atRiskCount === 1 ? " is" : "s are"} at risk of going inactive`);

  const summarySentence = clauses.length
    ? clauses.join(", ") + "."
    : "No unusual patterns today — sales, collections and customer activity all look normal.";

  return { text: [...factLines, summarySentence].join(" ") };
}
function pkrFmt(n) { return "PKR " + Math.round(Number(n) || 0).toLocaleString("en-PK"); }

async function resolveByName(supabase, table, nameCol, value) {
  const val = (value || "").toString().trim();
  if (!val) return null;
  const { data } = await supabase.from(table).select("id").ilike(nameCol, val).limit(1).maybeSingle();
  return data?.id || null;
}

async function resolveRiderByName(supabase, value) {
  const val = (value || "").toString().trim();
  if (!val) return null;
  const { data } = await supabase.from("profiles").select("id, roles!inner(key)").eq("roles.key", "rider").ilike("full_name", val).limit(1).maybeSingle();
  return data?.id || null;
}

// Same field set as the Customer Master form (CustomerForm.js) — a row here
// is just another way to fill it in, not a separate schema. Financial
// fields (rate, discount, credit limit, opening balance) are only written
// when the importing user holds customers.manage_financial, matching
// createCustomer/updateCustomer's gate.
export async function bulkImportCustomers(rows) {
  const { supabase, user } = await requireUser();
  const [businessId, role] = await Promise.all([getUserBusinessId(supabase, user.id), getUserRole(supabase, user)]);
  if (!businessId) return { error: "Your account is not assigned to a business.", imported: 0, failed: rows.length };
  const canManageFinancial = FINANCIAL_ROLES.includes(role);
  let imported = 0, failed = 0, duplicateCodesReassigned = 0;

  // A supplied "Customer Code" column is only realistic on a re-import/
  // migration file (this ID format doesn't exist anywhere else) — track
  // codes already in use (DB + earlier rows in this same file) so a
  // colliding supplied code gets a freshly generated EW-#### instead of
  // either silently overwriting another customer's ID or failing the whole
  // row over an ID clash that has nothing to do with the customer's data.
  const { data: existingCodesData } = await supabase.from("customers").select("code");
  const usedCodes = new Set((existingCodesData || []).map((c) => c.code));

  for (const r of rows) {
    // Only Name is a hard floor here — the bulk import template's other
    // required columns (Address, Area, Zone, Route, Rate, Payment
    // Frequency) are enforced client-side in the import preview before a
    // row ever reaches this action, matching what's actually mandatory for
    // the Owner's bulk upload rather than the fuller regular Customer
    // Master form. Mobile in particular is deliberately NOT required here
    // even though it still is on the New/Edit Customer form.
    const name = String(r.Name || r.name || r["Customer Name"] || "").trim();
    const mobile = String(r.Mobile || r.mobile || r.Phone || r.phone || "").trim();
    if (!name) { failed++; continue; }

    const zoneId = await resolveByName(supabase, "zones", "name", r.Zone || r.zone);
    const routeId = await resolveByName(supabase, "routes", "name", r.Route || r.route);
    const vehicleId = await resolveByName(supabase, "vehicles", "registration_no", r.Vehicle || r.vehicle);
    const riderId = await resolveRiderByName(supabase, r.Driver || r.driver);
    // Always resolves (never guarded on the value being present) — with no
    // Product column in this row, resolveProductId's own fallback chain
    // still lands on the standard 19L bottle, the same default every other
    // caller gets. Skipping the call entirely here (as before) meant a row
    // with only Rate filled in and no Product had nowhere to attach that
    // rate, silently dropping it below.
    const productValue = r.Product || r.product || r["Bottle Size"] || r.Size || r.size;
    const productId = await resolveProductId(supabase, productValue, null);
    const preferredDays = String(r["Delivery Days"] || r.DeliveryDays || "").split(",").map((d) => d.trim()).filter(Boolean);
    const status = String(r.Status || r.status || "active").trim().toLowerCase().replace(/\s+/g, "_") || "active";

    let code = String(r["Customer Code"] || r.Code || r.code || "").trim();
    if (code && usedCodes.has(code)) { duplicateCodesReassigned++; code = ""; }
    if (!code) {
      const { data: nextCode } = await supabase.rpc("fn_next_customer_code");
      code = nextCode || genCode("CUST");
    }
    usedCodes.add(code);

    const payload = {
      code,
      business_id: businessId,
      name,
      business_name: r.Company || r.company || r["Business Name"] || null,
      contact_person: r["Contact Person"] || r.ContactPerson || null,
      mobile,
      alternate_phone: r["Alternate Phone"] || r.AlternatePhone || null,
      whatsapp_number: r.WhatsApp || r.whatsapp || mobile,
      email: r.Email || r.email || null,
      customer_type: r["Customer Type"] || r.Type || "Home",
      address: r.Address || r.address || "",
      building: r.Building || r["Building / Flat"] || r.building || null,
      area: r.Area || r.area || null,
      zone_id: zoneId,
      route_id: routeId,
      route: r.Route || r.route || null,
      preferred_days: preferredDays.length ? preferredDays : null,
      assigned_rider_id: riderId,
      assigned_vehicle_id: vehicleId,
      default_product_id: productId,
      regular_qty: Number(r.Quantity || r.quantity || r.Qty || r.qty) || 0,
      payment_terms: r["Payment Terms"] || r.PaymentTerms || null,
      payment_frequency: ["Daily", "Weekly", "Monthly", "Custom"].includes(r["Payment Frequency"] || r.PaymentFrequency)
        ? (r["Payment Frequency"] || r.PaymentFrequency) : "Monthly",
      bottle_limit: Number(r["Bottle Limit"] || r.BottleLimit) || 20,
      opening_bottles_with_customer: Number(r["Opening Bottle Balance"] || r.OpeningBottleBalance) || 0,
      status,
      is_active: status === "active",
      notes: r.Notes || r.notes || null,
      created_by: user.id,
    };
    if (canManageFinancial) {
      payload.credit_limit = Number(r["Credit Limit"] || r.CreditLimit) || 0;
      payload.opening_balance = Number(r["Opening Balance"] || r.OpeningBalance) || 0;
      payload.discount_pct = Number(r.Discount || r.discount) || 0;
    }

    const { data: created, error } = await supabase.from("customers").insert(payload).select("id").single();
    if (error) { failed++; continue; }

    const rate = Number(r.Rate || r.rate);
    if (canManageFinancial && rate > 0 && productId) {
      await supabase.from("customer_prices").insert({
        customer_id: created.id, product_id: productId, price: rate,
        effective_from: new Date().toISOString().slice(0, 10), created_by: user.id,
      });
    }
    imported++;
  }
  revalidatePath("/customers");
  return { ok: true, imported, failed, duplicateCodesReassigned };
}

// Section 10's wide format: Customer ID | Customer | 19L Opening | 6L
// Opening | ... — one column per active bottle size. Each nonzero cell
// becomes a real "opening_balance" bottle_transactions entry (warehouse ->
// with_customer), the same mechanism every other movement uses — not a
// separate hardcoded balance. Re-importing the same customer+size is a
// no-op (skipped) rather than double-crediting them.
export async function bulkImportBottleOpeningBalances(rows) {
  const { supabase, user } = await requireUser();
  const { data: products } = await supabase.from("products").select("id, sku, size_label").eq("is_active", true);
  let imported = 0, failed = 0, skipped = 0;

  for (const r of rows) {
    const customerId = await findCustomerId(supabase, r);
    if (!customerId) { failed++; continue; }
    let rowImported = false;
    for (const p of products || []) {
      const key = Object.keys(r).find((k) => norm(k).includes(norm(p.size_label)) || norm(k).includes(norm(p.sku)));
      if (!key) continue;
      const qty = Number(r[key]);
      if (!qty || qty <= 0) continue;

      const { data: existing } = await supabase.from("bottle_transactions").select("id")
        .eq("customer_id", customerId).eq("product_id", p.id).eq("reference_type", "opening_balance").maybeSingle();
      if (existing) { skipped++; continue; }

      const { error } = await supabase.from("bottle_transactions").insert({
        product_id: p.id, quantity: qty, from_state: "warehouse", to_state: "with_customer",
        customer_id: customerId, reference_type: "opening_balance", created_by: user.id,
      });
      if (!error) rowImported = true;
    }
    if (rowImported) imported++; else failed++;
  }
  revalidatePath("/bottle-ledger");
  revalidatePath("/bottles");
  revalidatePath("/customers");
  return { ok: true, imported, failed, skipped };
}
function norm(s) { return (s || "").toString().toLowerCase().replace(/[^a-z0-9]/g, ""); }

export async function refreshAlerts() {
  const { supabase, user } = await requireUser();
  const before = new Date().toISOString();
  const { error } = await supabase.rpc("refresh_alerts");

  // Push newly-created alerts to the Owner's WhatsApp/SMS when "Owner
  // Alerts" (Automation Center) is on — best-effort, after refresh_alerts
  // has already fully committed its notification rows, same rule as
  // every other trigger point in this file.
  if (!error) {
    const businessId = await getUserBusinessId(supabase, user.id);
    if (businessId) {
      const { data: fresh } = await supabase.from("notifications").select("title, message")
        .eq("business_id", businessId).gte("created_at", before).in("severity", ["warning", "critical"]).limit(10);
      if (fresh?.length) {
        const { data: settings } = await supabase.from("business_settings").select("phone, whatsapp_number").maybeSingle();
        const ownerPhone = settings?.whatsapp_number || settings?.phone;
        if (ownerPhone) {
          const summary = fresh.map((n) => `• ${n.title}: ${n.message}`).join("\n");
          await notifyBestEffort({
            supabase, businessId, customerId: null, templateKey: "general_announcement",
            variables: { message: `New alerts:\n${summary}` }, automationKey: "owner_alerts", toNumberOverride: ownerPhone,
          });
        }
      }
    }
  }

  revalidatePath("/notifications");
  return { ok: !error, error: error?.message };
}

export async function markNotificationRead(id) {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("notifications").update({ is_read: true }).eq("id", id);
  revalidatePath("/notifications");
  return { ok: !error, error: error?.message };
}

export async function markAllNotificationsRead() {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("notifications").update({ is_read: true }).eq("is_read", false);
  revalidatePath("/notifications");
  return { ok: !error, error: error?.message };
}

// Communication Center's Retry button. RLS on notification_logs already
// restricts the underlying update to settings.manage, so a non-owner
// reaching this returns the RLS error rather than silently succeeding —
// same pattern as every other RLS-gated action in this file.
export async function retryNotificationLog(logId) {
  const { supabase, user } = await requireUser();
  const result = await retryNotification({ supabase, logId });
  await supabase.from("audit_logs").insert({ user_id: user.id, action: "RETRY", module: "notification_logs", record_id: logId, new_value: result });
  revalidatePath("/communication");
  return result;
}

// Physical stock-take for one bottle size. "Expected" is read live from
// v_bottle_reconciliation (same figure the Bottle Ledger page shows) so
// there's one source of truth, not a second copy of the calculation. A
// difference requires a reason and posts a corrective bottle_transactions
// entry — shortage moves warehouse->lost, excess moves adjustment->warehouse
// — so the ledger reflects it and future reconciliations start from the
// corrected count. RLS (bottles.manage) is the authorization gate; the
// bottle_reconciliations row plus the audit trigger on it is the audit log.
export async function recordBottleReconciliation(formData) {
  const { supabase, user } = await requireUser();
  const productId = formData.get("product_id");
  const physicalQty = Number(formData.get("physical_qty"));
  const reason = (formData.get("reason") || "").toString().trim() || null;
  if (!productId || Number.isNaN(physicalQty)) return { error: "Pick a bottle size and enter the physical count." };

  const { data: recon } = await supabase.from("v_bottle_reconciliation").select("warehouse").eq("product_id", productId).maybeSingle();
  const expectedQty = Number(recon?.warehouse || 0);
  const difference = physicalQty - expectedQty;
  if (difference !== 0 && !reason) return { error: "A reason is required when the physical count doesn't match the expected count." };

  let adjustmentTransactionId = null;
  if (difference !== 0) {
    const { data: txn, error: txnErr } = await supabase.from("bottle_transactions").insert({
      product_id: productId,
      quantity: Math.abs(difference),
      from_state: difference < 0 ? "warehouse" : "adjustment",
      to_state: difference < 0 ? "lost" : "warehouse",
      reference_type: "reconciliation",
      remarks: reason,
      created_by: user.id,
    }).select("id").single();
    if (txnErr) return { error: txnErr.message };
    adjustmentTransactionId = txn.id;
  }

  const { error } = await supabase.from("bottle_reconciliations").insert({
    product_id: productId,
    expected_qty: expectedQty,
    physical_qty: physicalQty,
    reason,
    adjustment_transaction_id: adjustmentTransactionId,
    created_by: user.id,
  });
  if (error) return { error: error.message };

  await supabase.from("audit_logs").insert({
    user_id: user.id, action: "BOTTLE_ADJUSTMENT", module: "bottle_reconciliations",
    new_value: { product_id: productId, expected_qty: expectedQty, physical_qty: physicalQty, difference, reason },
  });
  revalidatePath("/bottle-ledger");
  revalidatePath("/bottles");
  revalidatePath("/notifications");
  revalidatePath("/dashboard");
  return { ok: true, difference };
}

const METHOD_MAP = { Cash: "cash", "Bank Transfer": "bank", JazzCash: "jazzcash", Easypaisa: "easypaisa" };

async function findCustomerId(supabase, r) {
  const code = String(r["Customer ID"] || r.CustomerID || r.CustomerId || r.Code || r.code || "").trim();
  const phone = String(r.Phone || r.phone || r.CustomerPhone || "").trim();
  const name = String(r.Name || r.name || r.Customer || r.CustomerName || "").trim();
  if (code) {
    const { data } = await supabase.from("customers").select("id").eq("code", code).maybeSingle();
    if (data) return data.id;
  }
  if (phone) {
    const { data } = await supabase.from("customers").select("id").eq("mobile", phone).maybeSingle();
    if (data) return data.id;
  }
  if (name) {
    const { data } = await supabase.from("customers").select("id").ilike("name", name).limit(1).maybeSingle();
    if (data) return data.id;
  }
  return null;
}

export async function bulkImportPayments(rows) {
  const { supabase, user } = await requireUser();
  let imported = 0, failed = 0;
  for (const r of rows) {
    const customerId = await findCustomerId(supabase, r);
    const amount = Number(r.Amount || r.amount);
    if (!customerId || !amount) { failed++; continue; }
    const { data: receiptNo } = await supabase.rpc("fn_next_receipt_no");
    const method = METHOD_MAP[r.Method || r.method] || "cash";
    const { error } = await supabase.from("payments").insert({
      receipt_no: receiptNo,
      customer_id: customerId,
      amount,
      payment_date: r.Date || r.date || undefined,
      method,
      cash_account_id: await getCashAccountId(supabase, method),
      received_by: user.id,
    });
    if (error) failed++; else imported++;
  }
  revalidatePath("/payments");
  revalidatePath("/dashboard");
  revalidatePath("/ledger");
  return { ok: true, imported, failed };
}

export async function bulkImportExpenses(rows) {
  const { supabase, user } = await requireUser();
  let imported = 0, failed = 0;
  for (const r of rows) {
    const amount = Number(r.Amount || r.amount);
    const categoryName = String(r.Category || r.category || "Other").trim();
    if (!amount) { failed++; continue; }
    let { data: category } = await supabase.from("expense_categories").select("id").ilike("name", categoryName).maybeSingle();
    if (!category) ({ data: category } = await supabase.from("expense_categories").select("id").eq("name", "Other").maybeSingle());
    if (!category) { failed++; continue; }
    const status = await resolveExpenseStatus(supabase, amount);
    const { error } = await supabase.from("expenses").insert({
      expense_no: genCode("EXP"),
      category_id: category.id,
      description: r.Description || r.description || "",
      amount,
      expense_date: r.Date || r.date || undefined,
      payment_method: METHOD_MAP[r.Method || r.method] || "cash",
      status,
      submitted_by: user.id,
      created_by: user.id,
      approved_by: status === "approved" ? user.id : null,
      approved_at: status === "approved" ? new Date().toISOString() : null,
    });
    if (error) failed++; else imported++;
  }
  revalidatePath("/expenses");
  revalidatePath("/dashboard");
  return { ok: true, imported, failed };
}

export async function bulkImportSales(rows) {
  const { supabase, user } = await requireUser();
  let imported = 0, failed = 0;
  for (const r of rows) {
    const customerId = await findCustomerId(supabase, r);
    const qty = Number(r.Qty || r.qty);
    const paid = Number(r.Paid || r.paid) || 0;
    const productId = await resolveProductId(supabase, r.Product || r.product || r.Size || r.size, null);
    if (!customerId || !qty || !productId) { failed++; continue; }
    const { data: product } = await supabase.from("products").select("name").eq("id", productId).maybeSingle();
    const rate = await getEffectiveRate(supabase, customerId, productId);
    const total = qty * rate;
    const { data: invNo } = await supabase.rpc("fn_next_invoice_no");
    const status = paid >= total && total > 0 ? "paid" : paid > 0 ? "partially_paid" : "sent";
    const { data: invoice, error } = await supabase.from("invoices").insert({
      invoice_no: invNo, customer_id: customerId, invoice_date: r.Date || r.date || undefined,
      subtotal: total, discount: 0, tax: 0, net_amount: total, status, created_by: user.id,
    }).select("id").single();
    if (error) { failed++; continue; }
    await supabase.from("invoice_items").insert({
      invoice_id: invoice.id, product_id: productId, description: product?.name || "Bottle", quantity: qty, rate, discount: 0,
    });
    if (paid > 0) {
      const { data: receiptNo } = await supabase.rpc("fn_next_receipt_no");
      const method = METHOD_MAP[r.Method || r.method] || "cash";
      await supabase.from("payments").insert({
        receipt_no: receiptNo, customer_id: customerId, amount: paid,
        method, cash_account_id: await getCashAccountId(supabase, method), received_by: user.id, reference: invNo,
      });
    }
    imported++;
  }
  revalidatePath("/sales");
  revalidatePath("/dashboard");
  revalidatePath("/customers");
  return { ok: true, imported, failed };
}

// Bulk delivery upload logs PAST/completed deliveries (historical entry) —
// each row becomes a delivered record with bottle transactions and cash
// collected, exactly as if a rider had completed it via the app.
export async function bulkImportDeliveries(rows) {
  const { supabase, user } = await requireUser();
  const businessId = await getUserBusinessId(supabase, user.id);
  if (!businessId) return { error: "Your account is not assigned to a business.", imported: 0, failed: rows.length };
  let imported = 0, failed = 0;
  const errorRows = [];
  for (const [index, r] of rows.entries()) {
    const customerId = await findCustomerId(supabase, r);
    const qty = Number(r.Qty || r.qty);
    const productId = await resolveProductId(supabase, r.Product || r.product || r.Size || r.size, null);
    const returnedQty = r.Returned != null && r.Returned !== "" ? Number(r.Returned) : qty;
    // Credit customers are not automatically marked paid by an import.
    // Only an explicitly supplied cash collection posts a receipt.
    const cashCollected = r.CashCollected != null && r.CashCollected !== "" ? Number(r.CashCollected) : 0;
    const deliveryDate = r.Date || r.date || new Date().toISOString().slice(0, 10);
    if (!customerId || !productId || !Number.isInteger(qty) || qty <= 0 || !Number.isInteger(returnedQty) || returnedQty < 0 || !Number.isFinite(cashCollected) || cashCollected < 0) {
      failed++; errorRows.push({ ...r, Row: index + 1, Error: "Customer/product, positive whole Qty and non-negative Returned/CashCollected required." }); continue;
    }
    const fingerprint = createHash("sha256").update(JSON.stringify([businessId, customerId, productId, deliveryDate, qty, returnedQty, cashCollected, index])).digest("hex");
    const { error } = await supabase.rpc("fn_record_water_delivery", {
      p_customer_id: customerId, p_product_id: productId, p_delivery_date: deliveryDate,
      p_delivered_qty: qty, p_returned_qty: returnedQty, p_cash_collected: cashCollected,
      p_rider_id: user.id, p_request_id: `water-import-${fingerprint}`,
    });
    if (error) { failed++; errorRows.push({ ...r, Row: index + 1, Error: error.message }); continue; }
    imported++;
  }
  for (const path of ["/deliveries", "/bottles", "/bottle-ledger", "/dashboard", "/ledger", "/payments"]) revalidatePath(path);
  return { ok: true, imported, failed, errorRows };
}

export async function bulkImportPurchases(rows) {
  const { supabase, user } = await requireUser();
  let imported = 0, failed = 0;
  for (const r of rows) {
    const supplierName = String(r.Supplier || r.supplier || "").trim();
    const itemName = String(r.Item || r.item || "").trim();
    const qty = Number(r.Qty || r.qty);
    const rate = Number(r.Rate || r.rate);
    if (!supplierName || !itemName || !qty || !rate) { failed++; continue; }

    let { data: supplier } = await supabase.from("suppliers").select("id").ilike("name", supplierName).maybeSingle();
    if (!supplier) {
      const { data: newSupplier } = await supabase.from("suppliers").insert({ name: supplierName }).select("id").single();
      supplier = newSupplier;
    }
    if (!supplier) { failed++; continue; }

    let { data: invItem } = await supabase.from("inventory_items").select("id").ilike("name", itemName).maybeSingle();
    if (!invItem) {
      const { data: newItem } = await supabase.from("inventory_items").insert({ name: itemName, unit: "unit" }).select("id").single();
      invItem = newItem;
    }
    if (!invItem) { failed++; continue; }

    const { data: purchase, error } = await supabase.from("purchases").insert({
      purchase_no: genCode("PUR"), supplier_id: supplier.id, purchase_date: r.Date || r.date || undefined,
      status: "received", created_by: user.id,
    }).select("id").single();
    if (error) { failed++; continue; }

    await supabase.from("purchase_items").insert({ purchase_id: purchase.id, inventory_item_id: invItem.id, quantity: qty, rate, discount: 0 });
    await supabase.from("inventory_movements").insert({
      item_id: invItem.id, movement_type: "purchase", quantity: qty, unit_cost: rate,
      reference_type: "purchase", reference_id: purchase.id, created_by: user.id,
    });
    imported++;
  }
  revalidatePath("/inventory");
  return { ok: true, imported, failed };
}

// ============================================================
// ZONES / ROUTES
// ============================================================
export async function createZone(formData) {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("zones").insert({
    name: formData.get("name"),
    description: formData.get("description") || null,
  });
  if (error) return { error: error.message };
  revalidatePath("/zones");
  return { ok: true };
}

export async function updateZone(zoneId, formData) {
  const { supabase } = await requireUser();
  const name = (formData.get("name") || "").toString().trim();
  if (!name) return { error: "Zone name is required." };
  const { error } = await supabase.from("zones").update({
    name, description: formData.get("description") || null,
  }).eq("id", zoneId);
  if (error) return { error: error.message };
  revalidatePath("/zones");
  return { ok: true };
}

// Hard delete, gated on zones.delete (separate from settings.manage,
// migration 0012). FK from customers/expenses/profiles/routes into zones
// is NO ACTION — a zone still in use anywhere can't be deleted.
export async function deleteZone(zoneId, reason) {
  const { supabase, user } = await requireUser();
  const trimmed = (reason || "").toString().trim();
  if (!trimmed) return { error: "A reason is required to delete a zone." };

  const { error } = await supabase.from("zones").delete().eq("id", zoneId);
  if (error) {
    if (error.code === "23503") return { error: "Can't delete — this zone still has customers, routes, or other records assigned to it. Reassign those first." };
    return { error: error.message };
  }

  await supabase.from("audit_logs").insert({ user_id: user.id, action: "DELETE", module: "zones", record_id: zoneId, new_value: { reason: trimmed } });
  revalidatePath("/zones");
  return { ok: true };
}

// Phase 7 — Routes as a real entity (previously a free-text column on
// customers with no management page, no assignment, no reporting).
export async function createRoute(formData) {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("routes").insert({
    name: formData.get("name"),
    zone_id: formData.get("zone_id") || null,
    assigned_rider_id: formData.get("assigned_rider_id") || null,
    description: formData.get("description") || null,
  });
  if (error) return { error: error.message };
  revalidatePath("/zones");
  revalidatePath("/customers");
  return { ok: true };
}

export async function updateRoute(routeId, formData) {
  const { supabase } = await requireUser();
  const name = (formData.get("name") || "").toString().trim();
  if (!name) return { error: "Route name is required." };
  const { error } = await supabase.from("routes").update({
    name,
    zone_id: formData.get("zone_id") || null,
    assigned_rider_id: formData.get("assigned_rider_id") || null,
    description: formData.get("description") || null,
    is_active: formData.get("is_active") === "on",
  }).eq("id", routeId);
  if (error) return { error: error.message };
  revalidatePath("/zones");
  revalidatePath("/customers");
  return { ok: true };
}

// Hard delete, gated on routes.delete (separate from settings.manage,
// migration 0012). FK from customers into routes is NO ACTION — a route
// still assigned to a customer can't be deleted.
export async function deleteRoute(routeId, reason) {
  const { supabase, user } = await requireUser();
  const trimmed = (reason || "").toString().trim();
  if (!trimmed) return { error: "A reason is required to delete a route." };

  const { error } = await supabase.from("routes").delete().eq("id", routeId);
  if (error) {
    if (error.code === "23503") return { error: "Can't delete — this route still has customers assigned to it. Reassign those first." };
    return { error: error.message };
  }

  await supabase.from("audit_logs").insert({ user_id: user.id, action: "DELETE", module: "routes", record_id: routeId, new_value: { reason: trimmed } });
  revalidatePath("/zones");
  revalidatePath("/customers");
  return { ok: true };
}

export async function recordEmployeeAdvance(formData) {
  const { supabase, user } = await requireUser();
  const employeeId = formData.get("employee_id");
  const amount = Number(formData.get("amount"));
  if (!employeeId || !amount || amount <= 0) return { error: "Pick an employee and enter a valid advance amount." };
  const { error } = await supabase.from("employee_advances").insert({
    employee_id: employeeId,
    amount,
    advance_date: formData.get("advance_date") || new Date().toISOString().slice(0, 10),
    reason: formData.get("reason") || null,
    created_by: user.id,
  });
  if (error) return { error: error.message };
  await supabase.from("audit_logs").insert({ user_id: user.id, action: "CREATE", module: "employee_advances", new_value: { employee_id: employeeId, amount } });
  revalidatePath("/employees");
  revalidatePath(`/employees/${employeeId}`);
  return { ok: true };
}

// Advances have no cash/journal side effect of their own (no trigger on
// the table — verified) and nothing else references an advance row, so a
// hard delete (gated on the same users.manage the existing employee_advances
// RLS "ALL" policy already requires) is a real removal, not a void.
export async function deleteEmployeeAdvance(advanceId, reason) {
  const { supabase, user } = await requireUser();
  const trimmed = (reason || "").toString().trim();
  if (!trimmed) return { error: "A reason is required to delete an advance." };

  const { data: allowed } = await supabase.rpc("fn_has_permission", { perm_key: "users.manage" });
  if (!allowed) return { error: "You don't have permission to delete employee advances." };

  const { data: advance } = await supabase.from("employee_advances").select("employee_id").eq("id", advanceId).maybeSingle();
  const { error } = await supabase.from("employee_advances").delete().eq("id", advanceId);
  if (error) return { error: error.message };

  await supabase.from("audit_logs").insert({ user_id: user.id, action: "DELETE", module: "employee_advances", record_id: advanceId, new_value: { reason: trimmed } });
  revalidatePath("/employees");
  if (advance?.employee_id) revalidatePath(`/employees/${advance.employee_id}`);
  return { ok: true };
}

// Bug fix: employee_attendance has no marked_by column (only id/employee_id/
// attendance_date/status/check_in/check_out/notes/created_at) — the upsert
// below previously included one and would fail on every call. Verified
// against the live schema (qysuvxweyxbwtrvyocxl) before removing it.
export async function markAttendance(formData) {
  const { supabase } = await requireUser();
  const employeeId = formData.get("employee_id");
  const status = formData.get("status") || "present";
  if (!employeeId) return { error: "Pick an employee." };
  const attendanceDate = formData.get("attendance_date") || new Date().toISOString().slice(0, 10);
  const { error } = await supabase.from("employee_attendance")
    .upsert({ employee_id: employeeId, attendance_date: attendanceDate, status }, { onConflict: "employee_id,attendance_date" });
  if (error) return { error: error.message };
  revalidatePath("/employees");
  revalidatePath(`/employees/${employeeId}`);
  return { ok: true };
}

// Correcting a wrongly-marked day is normally just re-marking it (the
// upsert above overwrites same-day records) — this is for removing one
// entirely, e.g. a day that shouldn't have been marked at all. No
// financial/ledger effect to reverse, so a hard delete (same users.manage
// gate the table's own RLS already requires).
export async function deleteEmployeeAttendance(attendanceId, reason) {
  const { supabase, user } = await requireUser();
  const trimmed = (reason || "").toString().trim();
  if (!trimmed) return { error: "A reason is required to delete an attendance record." };

  const { data: allowed } = await supabase.rpc("fn_has_permission", { perm_key: "users.manage" });
  if (!allowed) return { error: "You don't have permission to delete attendance records." };

  const { data: record } = await supabase.from("employee_attendance").select("employee_id").eq("id", attendanceId).maybeSingle();
  const { error } = await supabase.from("employee_attendance").delete().eq("id", attendanceId);
  if (error) return { error: error.message };

  await supabase.from("audit_logs").insert({ user_id: user.id, action: "DELETE", module: "employee_attendance", record_id: attendanceId, new_value: { reason: trimmed } });
  revalidatePath("/employees");
  if (record?.employee_id) revalidatePath(`/employees/${record.employee_id}`);
  return { ok: true };
}

export async function updateEmployeeProfile(employeeId, formData) {
  const { supabase, user } = await requireUser();
  const fullName = (formData.get("full_name") || "").toString().trim();
  if (!fullName) return { error: "Name is required." };
  const { error } = await supabase.from("profiles").update({
    full_name: fullName,
    phone: formData.get("phone") || null,
    employee_code: formData.get("employee_code") || null,
    joining_date: formData.get("joining_date") || null,
    salary: formData.get("salary") ? Number(formData.get("salary")) : null,
    zone_id: formData.get("zone_id") || null,
    assigned_vehicle_id: formData.get("assigned_vehicle_id") || null,
  }).eq("id", employeeId);
  if (error) return { error: error.message };
  await supabase.from("audit_logs").insert({ user_id: user.id, action: "UPDATE", module: "employees", record_id: employeeId });
  revalidatePath("/employees");
  revalidatePath(`/employees/${employeeId}`);
  return { ok: true };
}

// ============================================================
// OWNER CONTROL: user management
// ============================================================
// SECURITY: the DB layer (trg_guard_profile_privilege on profiles) blocks
// role_id/is_active changes by anyone lacking users.manage, so this can't be
// bypassed even from raw SQL/PostgREST. These app-level checks are defense in
// depth: they give a clean error message instead of a raw DB error, and they
// cover the self-change / last-owner cases the trigger doesn't know about.
export async function updateUserRole(userId, roleKey) {
  const { supabase, user } = await requireUser();

  const { data: allowed } = await supabase.rpc("fn_has_permission", { perm_key: "users.manage" });
  if (!allowed) return { error: "You don't have permission to change user roles." };

  if (userId === user.id) return { error: "You can't change your own role from this screen." };

  const { data: role } = await supabase.from("roles").select("id, key").eq("key", roleKey).single();
  if (!role) return { error: "Unknown role" };

  const actorRole = await getUserRole(supabase, user);
  const { data: targetForOwnerGuard } = await supabase.from("profiles").select("roles(key)").eq("id", userId).maybeSingle();
  if ((role.key === "owner" || targetForOwnerGuard?.roles?.key === "owner") && actorRole !== "owner") {
    return { error: "Only an Owner can grant or change Owner access." };
  }

  if (role.key !== "owner") {
    const { data: target } = await supabase.from("profiles").select("id, roles(key)").eq("id", userId).maybeSingle();
    if (!target) return { error: "User not found." };
    if (target.roles?.key === "owner") {
      const { count } = await supabase.from("profiles").select("id, roles!inner(key)", { count: "exact", head: true }).eq("roles.key", "owner");
      if ((count || 0) <= 1) return { error: "Can't demote the last remaining Owner account." };
    }
  }

  const { error } = await supabase.from("profiles").update({ role_id: role.id }).eq("id", userId);
  if (!error) await supabase.from("audit_logs").insert({ user_id: user.id, action: "USER_CHANGE", module: "profiles", record_id: userId, new_value: { role: roleKey } });
  revalidatePath("/user-management");
  revalidatePath("/employees");
  return { ok: !error, error: error?.message };
}

export async function toggleUserActive(userId, isActive) {
  const { supabase, user } = await requireUser();

  const { data: allowed } = await supabase.rpc("fn_has_permission", { perm_key: "users.manage" });
  if (!allowed) return { error: "You don't have permission to change user status." };

  if (userId === user.id) return { error: "You can't deactivate your own account from this screen." };

  if (!isActive) {
    const { data: target } = await supabase.from("profiles").select("id, roles(key)").eq("id", userId).maybeSingle();
    if (!target) return { error: "User not found." };
    if (target.roles?.key === "owner") {
      const { count } = await supabase.from("profiles").select("id, roles!inner(key)", { count: "exact", head: true }).eq("roles.key", "owner").eq("is_active", true);
      if ((count || 0) <= 1) return { error: "Can't deactivate the last remaining active Owner account." };
    }
  }

  const { error } = await supabase.from("profiles").update({ is_active: isActive }).eq("id", userId);
  if (!error) await supabase.from("audit_logs").insert({ user_id: user.id, action: "USER_CHANGE", module: "profiles", record_id: userId, new_value: { is_active: isActive } });
  revalidatePath("/user-management");
  revalidatePath("/employees");
  return { ok: !error, error: error?.message };
}

// SECURITY: this had no auth check at all before — any caller, authenticated
// or not, could invite an arbitrary user at an arbitrary role (including
// owner) since it goes straight to the admin client. Gated the same way
// deleteUser already gates account deletion.
export async function inviteUser(formData) {
  const { supabase, user } = await requireUser();
  const { data: allowed } = await supabase.rpc("fn_has_permission", { perm_key: "users.manage" });
  if (!allowed) return { error: "You don't have permission to invite users." };

  // The service-role admin client bypasses RLS entirely, so it also bypasses
  // fn_stamp_business_id's auto-fill (that trigger reads auth.uid(), which
  // resolves to nothing for a service-role request) — business_id has to be
  // set explicitly here, to the inviting user's own business, or these
  // inserts fail their NOT NULL constraint.
  const { data: inviterProfile } = await supabase.from("profiles").select("business_id").eq("id", user.id).single();
  const businessId = inviterProfile?.business_id;
  if (!businessId) return { error: "Your account has no business assigned — contact support." };

  const admin = createAdminClient();
  const email = formData.get("email");
  const fullName = formData.get("full_name");
  const roleKey = formData.get("role");
  const phone = formData.get("phone") || null;
  const tempPassword = "Evergreen@" + Math.floor(1000 + Math.random() * 9000);

  if (roleKey === "owner" && await getUserRole(supabase, user) !== "owner") {
    return { error: "Only an Owner can invite another Owner." };
  }

  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email, password: tempPassword, email_confirm: true,
  });
  if (authError) return { error: authError.message };

  const { data: role } = await admin.from("roles").select("id").eq("key", roleKey).single();
  if (!role) return { error: "Unknown role" };

  const { error: profileError } = await admin.from("profiles").insert({
    id: authData.user.id, full_name: fullName, phone, role_id: role.id, is_active: true, business_id: businessId,
  });
  if (profileError) return { error: profileError.message };

  await admin.from("audit_logs").insert({ user_id: user.id, action: "USER_CHANGE", module: "profiles", record_id: authData.user.id, new_value: { action: "invited", role: roleKey }, business_id: businessId });
  revalidatePath("/user-management");
  return { ok: true, email, tempPassword };
}

// Permanent removal, not deactivation (toggleUserActive already covers
// that). Uses the admin client so it can delete the auth.users row via the
// Admin API, which bypasses RLS entirely — so the users.manage permission
// check has to happen explicitly here (via the same fn_has_permission the
// profiles RLS policies call), unlike updateUserRole/toggleUserActive which
// can lean on RLS since they go through the normal client.
export async function deleteUser(userId, reason) {
  const { supabase, user } = await requireUser();
  const trimmed = (reason || "").toString().trim();
  if (!trimmed) return { error: "A reason is required to delete a user." };

  const { data: allowed } = await supabase.rpc("fn_has_permission", { perm_key: "users.manage" });
  if (!allowed) return { error: "You don't have permission to delete users." };

  if (userId === user.id) return { error: "You can't delete your own account from this screen." };

  const { data: target } = await supabase.from("profiles").select("id, roles(key)").eq("id", userId).maybeSingle();
  if (!target) return { error: "User not found." };

  if (target.roles?.key === "owner") {
    const { count } = await supabase.from("profiles").select("id, roles!inner(key)", { count: "exact", head: true }).eq("roles.key", "owner");
    if ((count || 0) <= 1) return { error: "Can't delete the last remaining Owner account." };
  }

  // Same reasoning as inviteUser: the admin client bypasses RLS (and the
  // business_id auto-fill trigger, which needs a real user session), so the
  // audit log entry needs business_id set explicitly.
  const { data: actorProfile } = await supabase.from("profiles").select("business_id").eq("id", user.id).single();
  const businessId = actorProfile?.business_id;

  const admin = createAdminClient();
  // Profile first: if this person has deliveries/payments/other history the
  // foreign keys refuse the delete, and we stop before touching their login
  // (the old order could remove the login and then fail, leaving a broken
  // half-deleted account). Deactivate is the right action for such staff.
  const { error: profileError } = await admin.from("profiles").delete().eq("id", userId);
  if (profileError) {
    if (profileError.code === "23503") return { error: "Can't delete — this person has records (deliveries, payments, attendance…) that must stay for the audit trail. Deactivate them instead." };
    return { error: profileError.message };
  }

  const { error: authError } = await admin.auth.admin.deleteUser(userId);
  if (authError) return { error: `Profile removed, but the login could not be deleted: ${authError.message}` };

  await admin.from("audit_logs").insert({ user_id: user.id, action: "USER_CHANGE", module: "profiles", new_value: { action: "deleted", target_user_id: userId, reason: trimmed }, business_id: businessId });
  revalidatePath("/user-management");
  revalidatePath("/employees");
  return { ok: true };
}

// ============================================================
// OWNER CONTROL: per-user permission overrides
// ============================================================
// The actual authorization boundary is fn_has_permission() inside RLS —
// these three functions just let a users.manage holder edit the
// user_permission_overrides rows that function reads (override wins over
// the user's role default, see fn_has_permission's definition). Every
// write here still goes through the normal (non-admin) client, so RLS's
// own p_user_overrides_admin policy enforces the same users.manage check
// a second time at the database layer — these app-level checks exist for
// a clean error message and the self-edit guard, not as the only gate.

// Admin API is the only way to see a user's email (profiles has no email
// column) — used to populate the "assign by email or user ID" picker.
export async function getUserEmailsForManagement() {
  const { supabase } = await requireUser();
  const { data: allowed } = await supabase.rpc("fn_has_permission", { perm_key: "users.manage" });
  if (!allowed) return { error: "You don't have permission to manage users." };

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (error) return { error: error.message };
  return { ok: true, users: (data?.users || []).map((u) => ({
    id: u.id,
    email: u.email,
    phone: u.phone || null,
    lastSignInAt: u.last_sign_in_at || null,
  })) };
}

// allow: true (grant), false (deny), or null (clear override — fall back
// to the role default).
export async function setUserPermissionOverride(userId, permissionKey, allow) {
  const { supabase, user } = await requireUser();
  if (await getUserRole(supabase, user) !== "owner") return { error: "Only an Owner can manage user-specific permissions." };
  if (userId === user.id) return { error: "You can't change your own permissions from this screen." };
  return bulkSetUserPermissionOverrides(userId, [{ permissionKey, allow }]);
}

// Used by Select All / Clear All / Save so the whole grid commits as one
// round trip instead of one request per cell. updates: [{ permissionKey,
// allow: true|false|null }].
export async function bulkSetUserPermissionOverrides(userId, updates, reason = "") {
  const { supabase, user } = await requireUser();
  if (await getUserRole(supabase, user) !== "owner") return { error: "Only an Owner can manage user-specific permissions." };
  if (userId === user.id) return { error: "You can't change your own permissions from this screen." };
  if (!Array.isArray(updates) || updates.length === 0) return { ok: true };
  const normalized = updates.map((change) => ({
    permissionKey: String(change?.permissionKey || ""),
    allow: change?.allow === null ? null : Boolean(change?.allow),
  }));
  const { data: changed, error } = await supabase.rpc("fn_apply_user_permission_overrides", {
    p_user_id: userId,
    p_changes: normalized,
    p_reason: String(reason || "").trim() || null,
  });
  if (error) return { error: error.message };
  revalidatePath(`/user-management/permissions/${userId}`);
  revalidatePath("/user-management");
  return { ok: true, changed: Number(changed || 0) };
}

// "Reset" — drop every override for this user so their effective
// permissions become exactly their role's defaults again.
export async function resetUserPermissionOverrides(userId) {
  const { supabase, user } = await requireUser();
  if (await getUserRole(supabase, user) !== "owner") return { error: "Only an Owner can reset user-specific permissions." };
  if (userId === user.id) return { error: "You can't change your own permissions from this screen." };
  const { data: existing, error: readError } = await supabase.from("user_permission_overrides")
    .select("permissions(key)").eq("user_id", userId);
  if (readError) return { error: readError.message };
  const updates = (existing || []).map((row) => ({ permissionKey: row.permissions?.key, allow: null })).filter((row) => row.permissionKey);
  if (!updates.length) return { ok: true, changed: 0 };
  return bulkSetUserPermissionOverrides(userId, updates, "Reset to role defaults");
}

// --- Customer Portal (Phase 4) — staff-side actions ---
// Everything below is gated on deliveries.edit, matching the RLS policies
// on customer_issues/customer_feedback (migration 0033) exactly — a role
// that can't see/update these tables at the database level can't use
// these actions either.

async function notifyCustomerPortal({ supabase, businessId, customerId, title, message, type = "info", relatedType = null, relatedId = null }) {
  try {
    await supabase.from("customer_notifications").insert({ business_id: businessId, customer_id: customerId, title, message, type, related_type: relatedType, related_id: relatedId });
  } catch { /* best-effort — never blocks the staff action it's attached to */ }
}

// A customer's reported issue becomes a ticket only — resolving it never
// touches any financial record directly. If a correction is actually
// needed, the admin makes it through the normal delivery/payment/invoice
// workflow (its own audit trail), completely separate from this status
// change.
export async function updateCustomerIssueStatus(issueId, status, resolutionNote) {
  const { supabase, user } = await requireUser();
  const { data: allowed } = await supabase.rpc("fn_has_permission", { perm_key: "deliveries.edit" });
  if (!allowed) return { error: "You don't have permission to manage customer issues." };
  if (!["open", "under_review", "resolved", "rejected"].includes(status)) return { error: "Invalid status." };
  if ((status === "resolved" || status === "rejected") && !resolutionNote?.trim()) {
    return { error: "A resolution note is required to resolve or reject an issue." };
  }

  const { data: issue } = await supabase.from("customer_issues").select("business_id, customer_id, issue_type").eq("id", issueId).maybeSingle();
  if (!issue) return { error: "Issue not found." };

  const patch = { status, updated_at: new Date().toISOString() };
  if (status === "resolved" || status === "rejected") {
    patch.resolution_note = resolutionNote.trim();
    patch.resolved_by = user.id;
    patch.resolved_at = new Date().toISOString();
  }
  const { error } = await supabase.from("customer_issues").update(patch).eq("id", issueId);
  if (error) return { error: error.message };

  await supabase.from("audit_logs").insert({ user_id: user.id, action: "UPDATE", module: "customer_issues", record_id: issueId, new_value: { status } });

  const statusLabel = { open: "Open", under_review: "Under Review", resolved: "Resolved", rejected: "Rejected" }[status];
  await notifyCustomerPortal({
    supabase, businessId: issue.business_id, customerId: issue.customer_id,
    title: `Issue update: ${statusLabel}`,
    message: `Your reported issue "${issue.issue_type}" is now ${statusLabel}.${resolutionNote ? ` ${resolutionNote.trim()}` : ""}`,
    type: "issue", relatedType: "customer_issue", relatedId: issueId,
  });

  const { data: customer } = await supabase.from("customers").select("name").eq("id", issue.customer_id).maybeSingle();
  await notifyBestEffort({
    supabase, businessId: issue.business_id, customerId: issue.customer_id, templateKey: "issue_update",
    variables: { customer_name: customer?.name || "there", issue_type: issue.issue_type, status: statusLabel, resolution_note: resolutionNote || "" },
    // relatedType carries the status, not just "customer_issue" — the
    // idempotency unique index is per (business, related_type, related_id,
    // template_key), so without this a second status change on the SAME
    // issue (open -> under_review -> resolved) would collide with the
    // first one's row and get silently skipped as "duplicate" even though
    // it's a genuinely different notification.
    relatedType: `customer_issue_status_${status}`, relatedId: issueId,
  });

  revalidatePath("/issues");
  return { ok: true };
}

// Recovery Center → "Send Reminders to Selected" when WhatsApp sending is
// actually configured (Twilio credentials + a WhatsApp sender number).
// One click sends every selected customer the standard `payment_reminder`
// template through sendNotification(), so each message gets its own
// notification_logs row exactly like the automated reminder cron, plus a
// payment_reminders row on success (the cron's same-day / max-count guard
// sees these too). Balances are re-read here under RLS — the client only
// sends customer ids, never amounts.
export async function sendBulkPaymentReminders(customerIds) {
  const { supabase, user } = await requireUser();
  const ids = [...new Set((customerIds || []).map(String).filter((id) => /^[0-9a-f-]{36}$/i.test(id)))].slice(0, 200);
  if (!ids.length) return { error: "Select at least one customer." };

  // notification_logs rows can only be read back/updated with
  // settings.manage (RLS), which the send path needs to record the result.
  const [{ data: canRemind }, { data: canLog }] = await Promise.all([
    supabase.rpc("fn_has_permission", { perm_key: "payments.create" }),
    supabase.rpc("fn_has_permission", { perm_key: "settings.manage" }),
  ]);
  if (!canRemind || !canLog) return { error: "Only the Owner (or an admin with Settings access) can send automated reminders." };
  if (!isTwilioConfigured() || !process.env.TWILIO_WHATSAPP_NUMBER) {
    return { error: "WhatsApp sending isn't configured (Settings → Integrations), so reminders can't be sent automatically. Use the tap-through queue instead." };
  }

  const businessId = await getUserBusinessId(supabase, user.id);
  const { data: balances, error } = await supabase.from("v_customer_balance").select("customer_id, name, balance").in("customer_id", ids);
  if (error) return { error: error.message };
  const link = statementLine(appOrigin());

  let sent = 0, failed = 0, skipped = 0;
  const failures = [];
  const due = (balances || []).filter((b) => Number(b.balance) > 0);
  skipped += ids.length - due.length; // no longer owing (or not visible)
  // Small batches: fast for a typical selection without flooding Twilio.
  for (let i = 0; i < due.length; i += 5) {
    const results = await Promise.all(due.slice(i, i + 5).map(async (b) => {
      const result = await sendNotification({
        supabase, businessId, customerId: b.customer_id, templateKey: "payment_reminder",
        variables: { customer_name: b.name, amount: formatAmount(b.balance) },
        channel: "whatsapp", appendText: link,
      });
      if (result.ok) {
        await supabase.from("payment_reminders").insert({ business_id: businessId, customer_id: b.customer_id, channel: "whatsapp", sent_at: new Date().toISOString() });
      }
      return { b, result };
    }));
    for (const { b, result } of results) {
      if (result.ok) sent++;
      else if (result.skipped) skipped++;
      else { failed++; failures.push(`${b.name}: ${result.error}`); }
    }
  }

  await supabase.from("audit_logs").insert({ user_id: user.id, action: "BULK_REMINDER", module: "payments", new_value: { selected: ids.length, sent, failed, skipped, channel: "whatsapp" } });
  revalidatePath("/payments");
  revalidatePath("/communication");
  return { ok: true, sent, failed, skipped, failures: failures.slice(0, 5) };
}

// Bulk "Deactivate" on the Employees list: same checks as the Active toggle
// (users.manage, not yourself, never the last active Owner) via
// toggleUserActive, plus the bulk reason recorded in the audit log.
export async function deactivateUserWithReason(userId, reason) {
  const trimmed = (reason || "").toString().trim();
  if (!trimmed) return { error: "A reason is required." };
  const res = await toggleUserActive(userId, false);
  if (!res?.ok) return { error: res?.error || "Could not deactivate this user." };
  const { supabase, user } = await requireUser();
  await supabase.from("audit_logs").insert({ user_id: user.id, action: "USER_CHANGE", module: "profiles", record_id: userId, new_value: { is_active: false, reason: trimmed } });
  return { ok: true };
}
