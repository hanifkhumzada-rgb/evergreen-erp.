"use server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

async function requireUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return { supabase, user };
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
      const { data } = await supabase.from("products").select("id")
        .or(`sku.ilike.${val},size_label.ilike.${val},name.ilike.%${val}%`)
        .limit(1).maybeSingle();
      if (data) return data.id;
    }
  }
  if (fallbackProductId) return fallbackProductId;
  return getDefaultProduct(supabase);
}

export async function globalSearch(query) {
  const q = (query || "").trim();
  if (q.length < 2) return { customers: [], invoices: [], deliveries: [], payments: [], employees: [], vehicles: [] };
  const { supabase } = await requireUser();
  const pattern = `%${q}%`;
  const [{ data: customers }, { data: invoices }, { data: deliveries }, { data: payments }, { data: employees }, { data: vehicles }] = await Promise.all([
    supabase.from("customers").select("id, name, mobile, code").or(`name.ilike.${pattern},mobile.ilike.${pattern},code.ilike.${pattern}`).limit(5),
    supabase.from("invoices").select("id, invoice_no, customers(name)").ilike("invoice_no", pattern).limit(5),
    supabase.from("deliveries").select("id, delivery_no, delivery_date, customers(name)").ilike("delivery_no", pattern).limit(5),
    supabase.from("payments").select("id, receipt_no, customer_id, customers(name)").ilike("receipt_no", pattern).limit(5),
    supabase.from("profiles").select("id, full_name, roles!inner(key)").neq("roles.key", "customer").ilike("full_name", pattern).limit(5),
    supabase.from("vehicles").select("id, registration_no").ilike("registration_no", pattern).limit(5),
  ]);
  return { customers: customers || [], invoices: invoices || [], deliveries: deliveries || [], payments: payments || [], employees: employees || [], vehicles: vehicles || [] };
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

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
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

export async function createCustomer(formData) {
  const { supabase, user } = await requireUser();
  const role = await getUserRole(supabase, user);
  const canManageFinancial = FINANCIAL_ROLES.includes(role);

  const payload = {
    code: genCode("CUST"),
    ...customerBasicsFromForm(formData),
    is_active: (formData.get("status") || "active") === "active",
    created_by: user.id,
  };
  if (canManageFinancial) Object.assign(payload, customerFinancialsFromForm(formData));
  await syncLegacyRouteText(supabase, payload);

  const { data: created, error } = await supabase.from("customers").insert(payload).select("id").single();
  if (error) return { error: error.message };

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
  return { ok: true };
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

export async function createPayment(formData) {
  const { supabase, user } = await requireUser();
  const { data: receiptNo } = await supabase.rpc("fn_next_receipt_no");
  const methodMap = { Cash: "cash", "Bank Transfer": "bank", JazzCash: "jazzcash", Easypaisa: "easypaisa" };
  const method = methodMap[formData.get("method")] || "cash";
  const { error } = await supabase.from("payments").insert({
    receipt_no: receiptNo,
    customer_id: formData.get("customer_id"),
    amount: Number(formData.get("amount")),
    method,
    cash_account_id: await getCashAccountId(supabase, method),
    received_by: formData.get("collector_id") || user.id,
    notes: formData.get("notes") || null,
  });
  if (error) return { error: error.message };
  await supabase.from("audit_logs").insert({
    user_id: user.id, action: "CREATE", module: "payments",
    new_value: { customer_id: formData.get("customer_id"), amount: Number(formData.get("amount")), method, collected_by: formData.get("collector_id") || user.id },
  });
  revalidatePath("/payments");
  revalidatePath("/dashboard");
  revalidatePath("/customers");
  revalidatePath("/ledger");
  return { ok: true };
}

// Phase 2 — the interactive counterpart to bulkImportDeliveries: same
// insert shape (delivery -> delivery_items -> bottle_transactions ->
// optional cash_transactions), one row at a time from a form instead of a
// spreadsheet. Unlike the bulk path this always records rider_id — a
// manually-entered delivery always has a known responsible delivery boy.
export async function createDelivery(formData) {
  const { supabase, user } = await requireUser();
  const customerId = formData.get("customer_id");
  const productId = formData.get("product_id");
  const deliveredQty = Number(formData.get("delivered_qty"));
  const returnedQty = Number(formData.get("returned_qty")) || 0;
  const deliveryDate = formData.get("delivery_date") || new Date().toISOString().slice(0, 10);
  const riderId = formData.get("rider_id") || user.id;
  if (!customerId || !productId || !deliveredQty || deliveredQty <= 0) {
    return { error: "Pick a customer, bottle size, and a delivered quantity greater than zero." };
  }

  const { data: cashAccount } = await supabase.from("cash_accounts").select("id").eq("is_active", true).limit(1).maybeSingle();
  const rate = await getEffectiveRate(supabase, customerId, productId);
  const amount = deliveredQty * rate;
  const cashRaw = formData.get("cash_collected");
  const cashCollected = cashRaw != null && cashRaw !== "" ? Number(cashRaw) : 0;

  const { data: delivery, error } = await supabase.from("deliveries").insert({
    delivery_no: genCode("DEL"),
    customer_id: customerId,
    rider_id: riderId,
    delivery_date: deliveryDate,
    status: "delivered",
    amount,
    amount_collected: cashCollected,
    payment_method: "cash",
    delivered_at: new Date().toISOString(),
    created_by: user.id,
  }).select("id").single();
  if (error) return { error: error.message };

  await supabase.from("delivery_items").insert({
    delivery_id: delivery.id, product_id: productId, expected_qty: deliveredQty, delivered_qty: deliveredQty, returned_qty: returnedQty, unit_price: rate,
  });
  await supabase.from("bottle_transactions").insert({
    txn_date: deliveryDate, product_id: productId, quantity: deliveredQty,
    from_state: "with_rider", to_state: "with_customer", customer_id: customerId,
    reference_type: "delivery", reference_id: delivery.id, created_by: user.id,
  });
  if (returnedQty > 0) {
    await supabase.from("bottle_transactions").insert({
      txn_date: deliveryDate, product_id: productId, quantity: returnedQty,
      from_state: "with_customer", to_state: "with_rider", customer_id: customerId,
      reference_type: "delivery_return", reference_id: delivery.id, created_by: user.id,
    });
  }
  if (cashCollected > 0 && cashAccount) {
    await supabase.from("cash_transactions").insert({
      account_id: cashAccount.id, txn_date: deliveryDate, type: "receipt",
      amount: cashCollected, reference_type: "delivery", reference_id: delivery.id,
      description: "Delivery collection", created_by: user.id,
    });
  }
  await supabase.from("audit_logs").insert({
    user_id: user.id, action: "CREATE", module: "deliveries", record_id: delivery.id,
    new_value: { customer_id: customerId, product_id: productId, delivered_qty: deliveredQty, returned_qty: returnedQty, rate, amount, cash_collected: cashCollected, rider_id: riderId },
  });

  revalidatePath("/deliveries");
  revalidatePath("/bottles");
  revalidatePath("/bottle-ledger");
  revalidatePath("/dashboard");
  revalidatePath("/customers");
  revalidatePath(`/customers/${customerId}`);
  return { ok: true };
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
  const categoryName = formData.get("category");
  let { data: category } = await supabase.from("expense_categories").select("id").eq("name", categoryName).maybeSingle();
  if (!category) {
    ({ data: category } = await supabase.from("expense_categories").select("id").eq("name", "Other").maybeSingle());
  }
  if (!category) return { error: "No expense category configured" };
  const methodMap = { Cash: "cash", "Bank Transfer": "bank" };
  const amount = Number(formData.get("amount"));
  const status = await resolveExpenseStatus(supabase, amount);
  const { error } = await supabase.from("expenses").insert({
    expense_no: genCode("EXP"),
    category_id: category.id,
    description: formData.get("description"),
    amount,
    payment_method: methodMap[formData.get("method")] || "cash",
    status,
    submitted_by: user.id,
    created_by: user.id,
    approved_by: status === "approved" ? user.id : null,
    approved_at: status === "approved" ? new Date().toISOString() : null,
    receipt_reference: formData.get("receipt_reference") || null,
  });
  if (error) return { error: error.message };
  revalidatePath("/expenses");
  revalidatePath("/dashboard");
  return { ok: true };
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
  revalidatePath("/deliveries");
  revalidatePath("/bottles");
  revalidatePath("/bottle-ledger");
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

// RLS on automation_rules restricts updates to fn_has_permission('settings.manage')
// (owner), so a non-owner reaching this returns the RLS error rather than silently
// succeeding.
export async function updateAutomationRule(ruleId, formData) {
  const { supabase, user } = await requireUser();
  const { error } = await supabase.from("automation_rules").update({
    enabled: formData.get("enabled") === "on",
    threshold_value: Number(formData.get("threshold_value")) || 0,
    updated_by: user.id,
    updated_at: new Date().toISOString(),
  }).eq("id", ruleId);
  if (error) return { error: error.message };
  revalidatePath("/settings");
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

  const { data: invoices } = await supabase.from("invoices").select("net_amount").eq("invoice_date", closeDate);
  const { data: payments } = await supabase.from("payments").select("amount").eq("payment_date", closeDate);
  const { data: expenses } = await supabase.from("expenses").select("amount").eq("expense_date", closeDate).in("status", ["approved", "paid"]);

  const salesTotal = (invoices || []).reduce((a, s) => a + Number(s.net_amount), 0);
  const collectionsTotal = (payments || []).reduce((a, p) => a + Number(p.amount), 0);
  const expensesTotal = (expenses || []).reduce((a, e) => a + Number(e.amount), 0);
  const expectedCash = openingCash + collectionsTotal - expensesTotal;
  const difference = actualCash - expectedCash;

  const { data: cashAccount } = await supabase.from("cash_accounts").select("id").eq("is_active", true).limit(1).maybeSingle();
  if (!cashAccount) return { error: "No cash account configured" };

  const summary = JSON.stringify({ close_date: closeDate, opening_cash: openingCash, collections_total: collectionsTotal, expenses_total: expensesTotal, expected_cash: expectedCash, actual_cash: actualCash, difference });
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

  await supabase.from("audit_logs").insert({ user_id: user.id, action: "CLOSE_DAY", module: "cash_transactions", new_value: { close_date: closeDate, difference } });
  revalidatePath("/accounting/daily-closing");
  return { ok: true, difference, expectedCash };
}

export async function addVehicle(formData) {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("vehicles").insert({
    registration_no: formData.get("vehicle_no"),
    vehicle_type: formData.get("vehicle_type") || null,
    assigned_rider_id: formData.get("driver_employee_id") || null,
  });
  if (error) return { error: error.message };
  revalidatePath("/fleet");
  return { ok: true };
}

// Phase 9 — Fleet had no bulk import, unlike every other list module.
// Employees deliberately don't get one: creating a login-capable profile
// needs a real auth invite flow, not a plain table insert, and doing that
// wrong risks orphaned/broken accounts.
export async function bulkImportVehicles(rows) {
  const { supabase, user } = await requireUser();
  const { data: riders } = await supabase.from("profiles").select("id, full_name, roles!inner(key)").eq("roles.key", "rider");
  let imported = 0, failed = 0;
  for (const r of rows) {
    const regNo = String(r["Registration No"] || r.RegistrationNo || r.Vehicle || "").trim();
    if (!regNo) { failed++; continue; }
    const driverName = String(r.Driver || r.driver || "").trim();
    const rider = driverName ? (riders || []).find((p) => p.full_name?.toLowerCase() === driverName.toLowerCase()) : null;
    const { error } = await supabase.from("vehicles").insert({
      registration_no: regNo,
      vehicle_type: r["Vehicle Type"] || r.Type || null,
      assigned_rider_id: rider?.id || null,
      is_active: true,
    });
    if (error) { failed++; continue; }
    imported++;
  }
  revalidatePath("/fleet");
  return { ok: true, imported, failed };
}

export async function addVehicleExpense(formData) {
  const { supabase, user } = await requireUser();
  const category = formData.get("category");
  const amount = Number(formData.get("amount"));
  const vehicleId = formData.get("vehicle_id");
  const notes = formData.get("notes");

  // The live schema splits vehicle costs into fuel logs and maintenance logs
  // (there is no single "vehicle_expenses" table any more).
  const { error } = category === "Fuel"
    ? await supabase.from("vehicle_fuel_logs").insert({ vehicle_id: vehicleId, cost: amount, created_by: user.id })
    : await supabase.from("vehicle_maintenance_logs").insert({ vehicle_id: vehicleId, description: notes || category, cost: amount, created_by: user.id });
  if (error) return { error: error.message };
  revalidatePath("/fleet");
  return { ok: true };
}

function monthStartISO() { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10); }
function todayISO2() { return new Date().toISOString().slice(0, 10); }
function daysAgoISO(n) { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); }
// monthsAgo=1 -> last full calendar month, monthsAgo=3 -> three months back, etc.
function monthRange(monthsAgo) {
  const d = new Date();
  const start = new Date(d.getFullYear(), d.getMonth() - monthsAgo, 1);
  const end = new Date(d.getFullYear(), d.getMonth() - monthsAgo + 1, 0);
  return { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10), label: start.toLocaleDateString("en-US", { month: "long", year: "numeric" }) };
}

// Shared data-gathering for the "overdue"/"inactive"/"reduced orders" AI handlers,
// factored out so the individual questions and the combined "who should I follow
// up with" question use exactly the same logic instead of duplicating it.
async function getOverdueCustomers(supabase, days = 30) {
  const cutoff = daysAgoISO(days);
  const { data } = await supabase.from("invoices").select("net_amount, due_date, customers(name)")
    .neq("status", "paid").neq("status", "void").not("due_date", "is", null).lt("due_date", cutoff);
  const byCustomer = {};
  (data || []).forEach((i) => {
    const name = i.customers?.name;
    if (!name) return;
    byCustomer[name] = (byCustomer[name] || 0) + Number(i.net_amount);
  });
  return Object.entries(byCustomer).map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount);
}

async function getInactiveCustomerNames(supabase) {
  const { data } = await supabase.from("customers").select("name").eq("is_active", false);
  return (data || []).map((c) => c.name);
}

async function getReducedOrderCustomers(supabase, dropPct = 0.3) {
  const last = monthRange(1);
  const [{ data: thisMonthInv }, { data: lastMonthInv }] = await Promise.all([
    supabase.from("invoices").select("customer_id, customers(name), invoice_items(quantity)").neq("status", "void").gte("invoice_date", monthStartISO()),
    supabase.from("invoices").select("customer_id, customers(name), invoice_items(quantity)").neq("status", "void").gte("invoice_date", last.from).lte("invoice_date", last.to),
  ]);
  const qtyByCustomer = (rows) => {
    const m = {};
    (rows || []).forEach((inv) => {
      const name = inv.customers?.name || "Unknown";
      const qty = (inv.invoice_items || []).reduce((a, it) => a + Number(it.quantity), 0);
      m[inv.customer_id] = m[inv.customer_id] || { name, qty: 0 };
      m[inv.customer_id].qty += qty;
    });
    return m;
  };
  const thisM = qtyByCustomer(thisMonthInv);
  const lastM = qtyByCustomer(lastMonthInv);
  const drops = [];
  Object.keys(lastM).forEach((cid) => {
    const prevQty = lastM[cid].qty;
    const curQty = thisM[cid]?.qty || 0;
    if (prevQty > 0 && (curQty - prevQty) / prevQty <= -dropPct) {
      drops.push({ name: lastM[cid].name, prevQty, curQty, pct: Math.round(((curQty - prevQty) / prevQty) * 100) });
    }
  });
  return drops.sort((a, b) => a.pct - b.pct);
}

export async function askAI(question) {
  const { supabase, user } = await requireUser();
  const { data: profile } = await supabase.from("profiles").select("full_name, roles(key)").eq("id", user.id).single();
  const role = profile?.roles?.key;
  const financeAllowed = ["owner", "accountant"].includes(role);
  const ql = question.toLowerCase();

  const restricted = () => ({ text: "You don't have permission to access this information. Ask an Owner or Accountant." });

  if ((ql.includes("net profit") || ql.includes("profit") || ql.includes("revenue") || ql.includes("receivable") || ql.includes("payable")
    || ql.includes("overdue") || ql.includes("expense") || ql.includes("predict") || ql.includes("forecast")) && !financeAllowed) {
    return restricted();
  }

  if (ql.includes("net profit") || (ql.includes("profit") && ql.includes("why"))) {
    const from = monthStartISO(); const to = todayISO2();
    const { data: invoices } = await supabase.from("invoices").select("net_amount").neq("status", "void").gte("invoice_date", from).lte("invoice_date", to);
    const { data: expenses } = await supabase.from("expenses").select("amount").in("status", ["approved", "paid"]).gte("expense_date", from).lte("expense_date", to);
    const income = (invoices || []).reduce((a, i) => a + Number(i.net_amount), 0);
    const exp = (expenses || []).reduce((a, e) => a + Number(e.amount), 0);
    const net = income - exp;
    return { text: `This month so far: revenue ${pkrFmt(income)}, expenses ${pkrFmt(exp)} → net profit ${pkrFmt(net)}. This is a heuristic figure from your live invoices and expenses (the live database has no chart-of-accounts/journal engine), not a finalized statement.` };
  }
  if (ql.includes("receivable") || ql.includes("owe") || ql.includes("outstanding")) {
    const { data: customers } = await supabase.from("v_customer_balance").select("name, balance").order("balance", { ascending: false }).limit(5);
    const top = (customers || []).filter((c) => c.balance > 0);
    if (!top.length) return { text: "No outstanding receivables right now." };
    return { text: `Top receivables: ${top.map((c) => `${c.name} (${pkrFmt(c.balance)})`).join(", ")}.` };
  }
  if (ql.includes("inventory value") || ql.includes("stock value")) {
    const { data: products } = await supabase.from("products").select("id, name");
    const { data: stock } = await supabase.from("v_bottle_reconciliation").select("product_id, warehouse");
    const { data: prices } = await supabase.from("product_prices").select("product_id, price");
    const priceMap = {};
    (prices || []).forEach((p) => { priceMap[p.product_id] = Number(p.price); });
    const stockMap = {};
    (stock || []).forEach((s) => { stockMap[s.product_id] = Number(s.warehouse); });
    const total = (products || []).reduce((a, p) => a + (stockMap[p.id] || 0) * (priceMap[p.id] || 0), 0);
    return { text: `Inventory value at current selling price: ${pkrFmt(total)}, across ${(products || []).length} products.` };
  }
  if (ql.includes("collect") && (ql.includes("today") || ql.includes("day"))) {
    const today = todayISO2();
    const { data: payments } = await supabase.from("payments").select("amount").eq("payment_date", today);
    const total = (payments || []).reduce((a, p) => a + Number(p.amount), 0);
    return { text: `Collected today: ${pkrFmt(total)}.` };
  }
  if (ql.includes("closing difference") || ql.includes("closing")) {
    const { data: closing } = await supabase.from("cash_transactions").select("*").eq("reference_type", "daily_closing").order("txn_date", { ascending: false }).limit(1).maybeSingle();
    if (!closing) return { text: "No daily closing has been recorded yet." };
    let summary = {};
    try { summary = JSON.parse(closing.description); } catch {}
    return { text: `Last closing (${closing.txn_date}): expected ${pkrFmt(summary.expected_cash)}, actual ${pkrFmt(summary.actual_cash)}, difference ${pkrFmt(closing.amount)}.` };
  }
  if (ql.includes("bottle liability") || ql.includes("bottle") && ql.includes("liab")) {
    const { data: balances } = await supabase.from("v_customer_bottle_balance").select("bottles_with_customer");
    const withCustomers = (balances || []).reduce((a, b) => a + Number(b.bottles_with_customer), 0);
    return { text: `${withCustomers} bottles are currently with customers, valued at roughly ${pkrFmt(withCustomers * 800)} at replacement cost.` };
  }
  if (ql.includes("zone") && ql.includes("revenue")) {
    const { data: invoices } = await supabase.from("invoices").select("net_amount, customers(zone_id, zones(name))").neq("status", "void");
    const m = {};
    (invoices || []).forEach((s) => { const z = s.customers?.zones?.name || "Unassigned"; m[z] = (m[z] || 0) + Number(s.net_amount); });
    const sorted = Object.entries(m).sort((a, b) => b[1] - a[1]);
    if (!sorted.length) return { text: "Insufficient data to answer accurately." };
    return { text: `Top zone by revenue: ${sorted[0][0]} (${pkrFmt(sorted[0][1])}).` };
  }
  if (ql.includes("vehicle") && ql.includes("cost")) {
    const { data: fuel } = await supabase.from("vehicle_fuel_logs").select("cost, vehicles(registration_no)");
    const { data: maint } = await supabase.from("vehicle_maintenance_logs").select("cost, vehicles(registration_no)");
    const m = {};
    [...(fuel || []), ...(maint || [])].forEach((e) => { const v = e.vehicles?.registration_no || "Unknown"; m[v] = (m[v] || 0) + Number(e.cost); });
    const sorted = Object.entries(m).sort((a, b) => b[1] - a[1]);
    if (!sorted.length) return { text: "No vehicle expenses recorded yet." };
    return { text: `Highest-cost vehicle: ${sorted[0][0]} (${pkrFmt(sorted[0][1])} total).` };
  }
  if (ql.includes("driver") && ql.includes("best")) {
    const { data: deliveries } = await supabase.from("deliveries").select("status, profiles!deliveries_rider_id_fkey(full_name)");
    const m = {};
    (deliveries || []).forEach((d) => { const n = d.profiles?.full_name; if (!n) return; m[n] = m[n] || { done: 0, total: 0 }; m[n].total++; if (d.status === "delivered") m[n].done++; });
    const sorted = Object.entries(m).sort((a, b) => (b[1].done / b[1].total) - (a[1].done / a[1].total));
    if (!sorted.length) return { text: "Insufficient data to answer accurately." };
    return { text: `Best performing driver: ${sorted[0][0]} (${sorted[0][1].done}/${sorted[0][1].total} deliveries completed).` };
  }
  if (ql.includes("inactive")) {
    const { data: customers } = await supabase.from("customers").select("name").eq("is_active", false);
    if (!customers?.length) return { text: "No inactive or at-risk customers right now." };
    return { text: `Inactive/at-risk: ${customers.map((c) => c.name).join(", ")}.` };
  }
  if (ql.includes("stock") || ql.includes("reorder")) {
    const { data: products } = await supabase.from("products").select("id, name, low_stock_threshold");
    const { data: stock } = await supabase.from("v_bottle_reconciliation").select("product_id, warehouse");
    const stockMap = {};
    (stock || []).forEach((s) => { stockMap[s.product_id] = Number(s.warehouse); });
    const low = (products || []).filter((p) => (stockMap[p.id] || 0) < p.low_stock_threshold);
    if (!low.length) return { text: "All products are above their reorder level." };
    return { text: `Reorder recommended: ${low.map((p) => p.name).join(", ")}.` };
  }
  if (ql.includes("sold") || ql.includes("bottles")) {
    const { data: items } = await supabase.from("invoice_items").select("quantity");
    const total = (items || []).reduce((a, i) => a + Number(i.quantity), 0);
    return { text: `${total} bottles sold across all recorded invoices.` };
  }
  // NOTE: "which products need reordering" already routes into the stock/reorder
  // handler above — "reordering" contains "reorder" as a substring, so no extra
  // phrasing hook is needed there.

  if (ql.includes("overdue")) {
    if (!financeAllowed) return restricted();
    const overdue = await getOverdueCustomers(supabase, 30);
    if (!overdue.length) return { text: "No customers are overdue by more than 30 days." };
    const shown = overdue.slice(0, 10);
    return { text: `Overdue by more than 30 days (${overdue.length} customer${overdue.length === 1 ? "" : "s"}): ${shown.map((c) => `${c.name} (${pkrFmt(c.amount)})`).join(", ")}${overdue.length > shown.length ? `, and ${overdue.length - shown.length} more` : ""}.` };
  }
  if ((ql.includes("zone") || ql.includes("route")) && ql.includes("profit")) {
    const { data: invoices } = await supabase.from("invoices").select("net_amount, customers(zone_id, zones(name))").neq("status", "void");
    const m = {};
    (invoices || []).forEach((s) => { const z = s.customers?.zones?.name || "Unassigned"; m[z] = (m[z] || 0) + Number(s.net_amount); });
    const sorted = Object.entries(m).sort((a, b) => b[1] - a[1]);
    if (!sorted.length) return { text: "Insufficient data to answer accurately." };
    return { text: `${sorted[0][0]} generates the most revenue (${pkrFmt(sorted[0][1])}). Delivery and fuel costs aren't tagged by zone in the current data, so this is revenue-only — not true net profitability per zone.` };
  }
  if (ql.includes("reduced") || (ql.includes("order") && (ql.includes("fewer") || ql.includes("declin") || ql.includes("drop")))) {
    const drops = await getReducedOrderCustomers(supabase, 0.3);
    if (!drops.length) return { text: "No customers have reduced their orders by more than 30% this month compared to last." };
    const shown = drops.slice(0, 5);
    return { text: `Customers with a meaningful order drop (>30% fewer bottles) this month vs last: ${shown.map((d) => `${d.name} (${d.prevQty} → ${d.curQty} bottles, ${d.pct}%)`).join(", ")}.` };
  }
  if (ql.includes("expense") && (ql.includes("increas") || ql.includes("more") || ql.includes("higher") || ql.includes("up"))) {
    if (!financeAllowed) return restricted();
    const last = monthRange(1);
    const [{ data: thisMonthExp }, { data: lastMonthExp }] = await Promise.all([
      supabase.from("expenses").select("amount, expense_categories(name)").in("status", ["approved", "paid"]).gte("expense_date", monthStartISO()),
      supabase.from("expenses").select("amount, expense_categories(name)").in("status", ["approved", "paid"]).gte("expense_date", last.from).lte("expense_date", last.to),
    ]);
    const sumByCat = (rows) => {
      const m = {};
      (rows || []).forEach((e) => { const c = e.expense_categories?.name || "Other"; m[c] = (m[c] || 0) + Number(e.amount); });
      return m;
    };
    const thisM = sumByCat(thisMonthExp);
    const lastM = sumByCat(lastMonthExp);
    const increases = Object.keys(thisM)
      .filter((c) => thisM[c] > (lastM[c] || 0))
      .map((c) => ({ cat: c, from: lastM[c] || 0, to: thisM[c], diff: thisM[c] - (lastM[c] || 0) }))
      .sort((a, b) => b.diff - a.diff);
    if (!increases.length) return { text: "No expense category has increased this month compared to last." };
    return { text: `Expense categories up this month vs last: ${increases.slice(0, 5).map((i) => `${i.cat} (${pkrFmt(i.from)} → ${pkrFmt(i.to)}, +${pkrFmt(i.diff)})`).join(", ")}.` };
  }
  if (ql.includes("follow up") || ql.includes("followup") || ql.includes("follow-up")) {
    if (!financeAllowed) return restricted();
    const [overdue, inactiveNames, drops] = await Promise.all([
      getOverdueCustomers(supabase, 30),
      getInactiveCustomerNames(supabase),
      getReducedOrderCustomers(supabase, 0.3),
    ]);
    const priority = [];
    const seen = new Set();
    overdue.forEach((c) => { if (!seen.has(c.name)) { seen.add(c.name); priority.push(`${c.name} — overdue ${pkrFmt(c.amount)}`); } });
    inactiveNames.forEach((name) => { if (!seen.has(name)) { seen.add(name); priority.push(`${name} — inactive`); } });
    drops.forEach((d) => { if (!seen.has(d.name)) { seen.add(d.name); priority.push(`${d.name} — orders down ${Math.abs(d.pct)}%`); } });
    if (!priority.length) return { text: "No one needs follow-up right now — no overdue, inactive, or order-drop customers found." };
    return { text: `Top follow-ups: ${priority.slice(0, 5).join("; ")}.` };
  }
  if (ql.includes("predict") || ql.includes("forecast") || ql.includes("next month")) {
    if (!financeAllowed) return restricted();
    const [m3, m2, m1] = [monthRange(3), monthRange(2), monthRange(1)];
    const sums = await Promise.all([m3, m2, m1].map(async (m) => {
      const { data } = await supabase.from("invoices").select("net_amount").neq("status", "void").gte("invoice_date", m.from).lte("invoice_date", m.to);
      return (data || []).reduce((a, i) => a + Number(i.net_amount), 0);
    }));
    const [s3, s2, s1] = sums;
    if (s3 === 0 && s2 === 0 && s1 === 0) return { text: "Insufficient data to answer accurately — no sales recorded in the last 3 months." };
    const g1 = s3 > 0 ? (s2 - s3) / s3 : 0;
    const g2 = s2 > 0 ? (s1 - s2) / s2 : 0;
    const avgGrowth = (g1 + g2) / 2;
    const trailingAvg = (s3 + s2 + s1) / 3;
    const projection = Math.max(0, trailingAvg * (1 + avgGrowth));
    return { text: `Estimate based on the last 3 months' trend — actual results may vary: projected sales next month ≈ ${pkrFmt(projection)} (trailing 3-month average ${pkrFmt(trailingAvg)}, avg. month-over-month growth ${(avgGrowth * 100).toFixed(1)}%).` };
  }
  return { text: "Insufficient data to answer accurately. Try asking about receivables, inventory value, today's collections, bottle liability, overdue customers, or a sales forecast." };
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
  const role = await getUserRole(supabase, user);
  const canManageFinancial = FINANCIAL_ROLES.includes(role);
  let imported = 0, failed = 0;

  for (const r of rows) {
    const name = String(r.Name || r.name || r["Customer Name"] || "").trim();
    const mobile = String(r.Mobile || r.mobile || r.Phone || r.phone || "").trim();
    if (!name || !mobile) { failed++; continue; }

    const zoneId = await resolveByName(supabase, "zones", "name", r.Zone || r.zone);
    const vehicleId = await resolveByName(supabase, "vehicles", "registration_no", r.Vehicle || r.vehicle);
    const riderId = await resolveRiderByName(supabase, r.Driver || r.driver);
    const productValue = r.Product || r.product || r["Bottle Size"] || r.Size || r.size;
    const productId = productValue ? await resolveProductId(supabase, productValue, null) : null;
    const preferredDays = String(r["Delivery Days"] || r.DeliveryDays || "").split(",").map((d) => d.trim()).filter(Boolean);
    const status = String(r.Status || r.status || "active").trim().toLowerCase().replace(/\s+/g, "_") || "active";

    const payload = {
      code: String(r["Customer Code"] || r.Code || r.code || "").trim() || genCode("CUST"),
      name,
      business_name: r.Company || r.company || r["Business Name"] || null,
      contact_person: r["Contact Person"] || r.ContactPerson || null,
      mobile,
      alternate_phone: r["Alternate Phone"] || r.AlternatePhone || null,
      whatsapp_number: r.WhatsApp || r.whatsapp || mobile,
      email: r.Email || r.email || null,
      customer_type: r["Customer Type"] || r.Type || "Home",
      address: r.Address || r.address || "",
      area: r.Area || r.area || null,
      zone_id: zoneId,
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
  return { ok: true, imported, failed };
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
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("refresh_alerts");
  revalidatePath("/notifications");
  return { ok: !error, error: error?.message };
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
  const { data: cashAccount } = await supabase.from("cash_accounts").select("id").eq("is_active", true).limit(1).maybeSingle();
  let imported = 0, failed = 0;
  for (const r of rows) {
    const customerId = await findCustomerId(supabase, r);
    const qty = Number(r.Qty || r.qty);
    const productId = await resolveProductId(supabase, r.Product || r.product || r.Size || r.size, null);
    if (!customerId || !qty || !productId) { failed++; continue; }
    // Historical bulk entry assumes a straight bottle swap (empties returned
    // = full bottles delivered) unless the template gives a Returned column.
    const returnedQty = r.Returned != null && r.Returned !== "" ? Number(r.Returned) : qty;
    const rate = await getEffectiveRate(supabase, customerId, productId);
    const cashCollected = r.CashCollected != null && r.CashCollected !== "" ? Number(r.CashCollected) : qty * rate;

    const { data: delivery, error } = await supabase.from("deliveries").insert({
      delivery_no: genCode("DEL"),
      customer_id: customerId,
      delivery_date: r.Date || r.date || undefined,
      status: "delivered",
      amount: qty * rate,
      amount_collected: cashCollected,
      payment_method: "cash",
      delivered_at: new Date().toISOString(),
      created_by: user.id,
    }).select("id").single();
    if (error) { failed++; continue; }

    await supabase.from("delivery_items").insert({
      delivery_id: delivery.id, product_id: productId, expected_qty: qty, delivered_qty: qty, returned_qty: returnedQty, unit_price: rate,
    });
    await supabase.from("bottle_transactions").insert({
      txn_date: r.Date || r.date || undefined, product_id: productId, quantity: qty,
      from_state: "with_rider", to_state: "with_customer", customer_id: customerId,
      reference_type: "delivery", reference_id: delivery.id, created_by: user.id,
    });
    if (returnedQty > 0) {
      await supabase.from("bottle_transactions").insert({
        txn_date: r.Date || r.date || undefined, product_id: productId, quantity: returnedQty,
        from_state: "with_customer", to_state: "with_rider", customer_id: customerId,
        reference_type: "delivery_return", reference_id: delivery.id, created_by: user.id,
      });
    }
    if (cashCollected > 0 && cashAccount) {
      await supabase.from("cash_transactions").insert({
        account_id: cashAccount.id, txn_date: r.Date || r.date || undefined, type: "receipt",
        amount: cashCollected, reference_type: "delivery", reference_id: delivery.id,
        description: "Bulk-imported delivery collection", created_by: user.id,
      });
    }
    imported++;
  }
  revalidatePath("/deliveries");
  revalidatePath("/bottles");
  revalidatePath("/bottle-ledger");
  revalidatePath("/dashboard");
  return { ok: true, imported, failed };
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
  return { ok: true };
}

export async function markAttendance(formData) {
  const { supabase, user } = await requireUser();
  const employeeId = formData.get("employee_id");
  const status = formData.get("status") || "present";
  if (!employeeId) return { error: "Pick an employee." };
  const attendanceDate = formData.get("attendance_date") || new Date().toISOString().slice(0, 10);
  const { error } = await supabase.from("employee_attendance")
    .upsert({ employee_id: employeeId, attendance_date: attendanceDate, status, marked_by: user.id }, { onConflict: "employee_id,attendance_date" });
  if (error) return { error: error.message };
  revalidatePath("/employees");
  return { ok: true };
}

export async function updateEmployeeProfile(employeeId, formData) {
  const { supabase, user } = await requireUser();
  const { error } = await supabase.from("profiles").update({
    employee_code: formData.get("employee_code") || null,
    joining_date: formData.get("joining_date") || null,
    salary: formData.get("salary") ? Number(formData.get("salary")) : null,
    zone_id: formData.get("zone_id") || null,
    assigned_vehicle_id: formData.get("assigned_vehicle_id") || null,
  }).eq("id", employeeId);
  if (error) return { error: error.message };
  await supabase.from("audit_logs").insert({ user_id: user.id, action: "UPDATE", module: "employees", record_id: employeeId });
  revalidatePath("/employees");
  return { ok: true };
}

// ============================================================
// OWNER CONTROL: user management
// ============================================================
export async function updateUserRole(userId, roleKey) {  const { supabase } = await requireUser();
  const { data: role } = await supabase.from("roles").select("id").eq("key", roleKey).single();
  if (!role) return { error: "Unknown role" };
  const { error } = await supabase.from("profiles").update({ role_id: role.id }).eq("id", userId);
  revalidatePath("/user-management");
  revalidatePath("/employees");
  return { ok: !error, error: error?.message };
}

export async function toggleUserActive(userId, isActive) {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("profiles").update({ is_active: isActive }).eq("id", userId);
  revalidatePath("/user-management");
  revalidatePath("/employees");
  return { ok: !error, error: error?.message };
}

export async function inviteUser(formData) {
  const admin = createAdminClient();
  const email = formData.get("email");
  const fullName = formData.get("full_name");
  const roleKey = formData.get("role");
  const phone = formData.get("phone") || null;
  const tempPassword = "Evergreen@" + Math.floor(1000 + Math.random() * 9000);

  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email, password: tempPassword, email_confirm: true,
  });
  if (authError) return { error: authError.message };

  const { data: role } = await admin.from("roles").select("id").eq("key", roleKey).single();
  if (!role) return { error: "Unknown role" };

  const { error: profileError } = await admin.from("profiles").insert({
    id: authData.user.id, full_name: fullName, phone, role_id: role.id, is_active: true,
  });
  if (profileError) return { error: profileError.message };

  revalidatePath("/user-management");
  return { ok: true, email, tempPassword };
}

// Permanent removal, not deactivation (toggleUserActive already covers
// that). Uses the admin client so it can delete the auth.users row via the
// Admin API, which bypasses RLS entirely — so the users.manage permission
// check has to happen explicitly here (via the same fn_has_permission the
// profiles RLS policies call), unlike updateUserRole/toggleUserActive which
// can lean on RLS since they go through the normal client.
export async function deleteUser(userId) {
  const { supabase, user } = await requireUser();

  const { data: allowed } = await supabase.rpc("fn_has_permission", { perm_key: "users.manage" });
  if (!allowed) return { error: "You don't have permission to delete users." };

  if (userId === user.id) return { error: "You can't delete your own account from this screen." };

  const { data: target } = await supabase.from("profiles").select("id, roles(key)").eq("id", userId).maybeSingle();
  if (!target) return { error: "User not found." };

  if (target.roles?.key === "owner") {
    const { count } = await supabase.from("profiles").select("id, roles!inner(key)", { count: "exact", head: true }).eq("roles.key", "owner");
    if ((count || 0) <= 1) return { error: "Can't delete the last remaining Owner account." };
  }

  const admin = createAdminClient();
  const { error: authError } = await admin.auth.admin.deleteUser(userId);
  if (authError) return { error: authError.message };

  const { error: profileError } = await admin.from("profiles").delete().eq("id", userId);
  if (profileError) return { error: profileError.message };

  revalidatePath("/user-management");
  revalidatePath("/employees");
  return { ok: true };
}
