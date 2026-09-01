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

// The live schema has one primary retail product (19L bottle, sku "19L"). The
// UI only ever asks for a quantity (no product picker), so every sale /
// delivery is recorded against this product.
async function getDefaultProduct(supabase) {
  const { data } = await supabase.from("products").select("id").eq("sku", "19L").single();
  return data?.id || null;
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

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function createCustomer(formData) {
  const { supabase, user } = await requireUser();
  const payload = {
    code: genCode("CUST"),
    name: formData.get("name"),
    mobile: formData.get("phone"),
    whatsapp_number: formData.get("phone"),
    zone_id: formData.get("zone_id") || null,
    customer_type: formData.get("customer_type"),
    address: formData.get("address") || "",
    created_by: user.id,
  };
  const { data: created, error } = await supabase.from("customers").insert(payload).select("id").single();
  if (error) return { error: error.message };

  // The live schema no longer stores a per-customer default rate directly on
  // the customer row — pricing is per-product (product_prices / customer_prices).
  // Preserve the "rate per bottle" the form still asks for by saving it as
  // this customer's override price for the default (19L) product.
  const rate = Number(formData.get("rate"));
  if (rate > 0) {
    const productId = await getDefaultProduct(supabase);
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
  revalidatePath("/customers");
  return { ok: true };
}

export async function createSale(formData) {
  const { supabase, user } = await requireUser();
  const customerId = formData.get("customer_id");
  const qty = Number(formData.get("qty"));
  const paid = Number(formData.get("paid")) || 0;

  const productId = await getDefaultProduct(supabase);
  if (!productId) return { error: "No default product configured" };
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
    description: "19L Bottle",
    quantity: qty,
    rate,
    discount: 0,
  });
  if (itemErr) return { error: itemErr.message };

  if (paid > 0) {
    const { data: receiptNo } = await supabase.rpc("fn_next_receipt_no");
    const methodMap = { Cash: "cash", "Bank Transfer": "bank", JazzCash: "jazzcash", Easypaisa: "easypaisa" };
    await supabase.from("payments").insert({
      receipt_no: receiptNo,
      customer_id: customerId,
      amount: paid,
      method: methodMap[formData.get("payment_method")] || "cash",
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
  const { error } = await supabase.from("payments").insert({
    receipt_no: receiptNo,
    customer_id: formData.get("customer_id"),
    amount: Number(formData.get("amount")),
    method: methodMap[formData.get("method")] || "cash",
    received_by: user.id,
  });
  if (error) return { error: error.message };
  revalidatePath("/payments");
  revalidatePath("/dashboard");
  revalidatePath("/customers");
  revalidatePath("/ledger");
  return { ok: true };
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
  const { error } = await supabase.from("expenses").insert({
    expense_no: genCode("EXP"),
    category_id: category.id,
    description: formData.get("description"),
    amount: Number(formData.get("amount")),
    payment_method: methodMap[formData.get("method")] || "cash",
    status: "approved",
    submitted_by: user.id,
    created_by: user.id,
  });
  if (error) return { error: error.message };
  revalidatePath("/expenses");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function markDelivered(deliveryId, emptyReceived) {
  const { supabase, user } = await requireUser();
  const { data: d } = await supabase.from("deliveries").select("delivery_date, customer_id, delivery_items(product_id, expected_qty, unit_price)").eq("id", deliveryId).single();
  if (!d) return { error: "Delivery not found" };

  const items = [];
  for (const it of d.delivery_items || []) {
    const unitPrice = Number(it.unit_price) > 0 ? Number(it.unit_price) : await getEffectiveRate(supabase, d.customer_id, it.product_id);
    items.push({ product_id: it.product_id, delivered_qty: it.expected_qty, returned_qty: emptyReceived, unit_price: unitPrice });
  }
  const total = items.reduce((a, it) => a + it.delivered_qty * it.unit_price, 0);
  const { data: cashAccount } = await supabase.from("cash_accounts").select("id").eq("is_active", true).limit(1).maybeSingle();

  const { error } = await supabase.rpc("record_delivery_completion", {
    p_delivery_id: deliveryId,
    p_items: items,
    p_status: "delivered",
    p_amount_collected: total,
    p_payment_method: "cash",
    p_cash_account_id: cashAccount?.id || null,
  });
  if (error) return { error: error.message };
  revalidatePath("/deliveries");
  revalidatePath("/bottles");
  revalidatePath("/bottle-ledger");
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
  const { data: expenses } = await supabase.from("expenses").select("amount").eq("expense_date", closeDate);

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

export async function askAI(question) {
  const { supabase, user } = await requireUser();
  const { data: profile } = await supabase.from("profiles").select("full_name, roles(key)").eq("id", user.id).single();
  const role = profile?.roles?.key;
  const financeAllowed = ["owner", "accountant"].includes(role);
  const ql = question.toLowerCase();

  const restricted = () => ({ text: "You don't have permission to access this information. Ask an Owner or Accountant." });

  if ((ql.includes("net profit") || ql.includes("profit") || ql.includes("revenue") || ql.includes("receivable") || ql.includes("payable")) && !financeAllowed) {
    return restricted();
  }

  if (ql.includes("net profit") || (ql.includes("profit") && ql.includes("why"))) {
    const from = monthStartISO(); const to = todayISO2();
    const { data: invoices } = await supabase.from("invoices").select("net_amount").neq("status", "void").gte("invoice_date", from).lte("invoice_date", to);
    const { data: expenses } = await supabase.from("expenses").select("amount").neq("status", "rejected").gte("expense_date", from).lte("expense_date", to);
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
  return { text: "Insufficient data to answer accurately. Try asking about receivables, inventory value, today's collections, or bottle liability." };
}
function pkrFmt(n) { return "PKR " + Math.round(Number(n) || 0).toLocaleString("en-PK"); }

export async function bulkImportCustomers(rows) {
  const { supabase, user } = await requireUser();
  const payload = rows.map((r) => ({
    code: genCode("CUST"),
    name: r.Name || r.name || "Unnamed",
    mobile: String(r.Phone || r.phone || ""),
    whatsapp_number: String(r.Phone || r.phone || ""),
    address: r.Address || "",
    customer_type: r.Type || "Household",
    created_by: user.id,
  })).filter((r) => r.mobile);
  const { data, error } = await supabase.from("customers").insert(payload).select("id");
  revalidatePath("/customers");
  return { ok: !error, imported: data?.length || 0, failed: payload.length - (data?.length || 0), error: error?.message };
}

export async function refreshAlerts() {
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("refresh_alerts");
  revalidatePath("/notifications");
  return { ok: !error, error: error?.message };
}

const METHOD_MAP = { Cash: "cash", "Bank Transfer": "bank", JazzCash: "jazzcash", Easypaisa: "easypaisa" };

async function findCustomerId(supabase, r) {
  const phone = String(r.Phone || r.phone || r.CustomerPhone || "").trim();
  const name = String(r.Name || r.name || r.Customer || r.CustomerName || "").trim();
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
    const { error } = await supabase.from("payments").insert({
      receipt_no: receiptNo,
      customer_id: customerId,
      amount,
      payment_date: r.Date || r.date || undefined,
      method: METHOD_MAP[r.Method || r.method] || "cash",
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
    const { error } = await supabase.from("expenses").insert({
      expense_no: genCode("EXP"),
      category_id: category.id,
      description: r.Description || r.description || "",
      amount,
      expense_date: r.Date || r.date || undefined,
      payment_method: METHOD_MAP[r.Method || r.method] || "cash",
      status: "approved",
      submitted_by: user.id,
      created_by: user.id,
    });
    if (error) failed++; else imported++;
  }
  revalidatePath("/expenses");
  revalidatePath("/dashboard");
  return { ok: true, imported, failed };
}

export async function bulkImportSales(rows) {
  const { supabase, user } = await requireUser();
  const productId = await getDefaultProduct(supabase);
  let imported = 0, failed = 0;
  for (const r of rows) {
    const customerId = await findCustomerId(supabase, r);
    const qty = Number(r.Qty || r.qty);
    const paid = Number(r.Paid || r.paid) || 0;
    if (!customerId || !qty || !productId) { failed++; continue; }
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
      invoice_id: invoice.id, product_id: productId, description: "19L Bottle", quantity: qty, rate, discount: 0,
    });
    if (paid > 0) {
      const { data: receiptNo } = await supabase.rpc("fn_next_receipt_no");
      await supabase.from("payments").insert({
        receipt_no: receiptNo, customer_id: customerId, amount: paid,
        method: METHOD_MAP[r.Method || r.method] || "cash", received_by: user.id, reference: invNo,
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
  const productId = await getDefaultProduct(supabase);
  const { data: cashAccount } = await supabase.from("cash_accounts").select("id").eq("is_active", true).limit(1).maybeSingle();
  let imported = 0, failed = 0;
  for (const r of rows) {
    const customerId = await findCustomerId(supabase, r);
    const qty = Number(r.Qty || r.qty);
    if (!customerId || !qty || !productId) { failed++; continue; }
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
      delivery_id: delivery.id, product_id: productId, expected_qty: qty, delivered_qty: qty, returned_qty: qty, unit_price: rate,
    });
    await supabase.from("bottle_transactions").insert({
      txn_date: r.Date || r.date || undefined, product_id: productId, quantity: qty,
      from_state: "with_rider", to_state: "with_customer", customer_id: customerId,
      reference_type: "delivery", reference_id: delivery.id, created_by: user.id,
    });
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
