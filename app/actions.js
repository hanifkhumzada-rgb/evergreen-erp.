"use server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { REMEMBER_ME_COOKIE } from "@/lib/rememberMe";
import { sendNotification, retryNotification } from "@/lib/notifications";
import { createHash, randomUUID } from "node:crypto";

async function requireUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return { supabase, user };
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
    supabase.from("vehicles").select("…21832 tokens truncated…while: between half the customer_inactive threshold and the threshold
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
  const businessId = await getUserBusinessId(supabase, user.id);
  if (!businessId) return { error: "Your account is not assigned to a business.", imported: 0, failed: rows.length };
  const role = await getUserRole(supabase, user);
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
  const { error: authError } = await admin.auth.admin.deleteUser(userId);
  if (authError) return { error: authError.message };

  const { error: profileError } = await admin.from("profiles").delete().eq("id", userId);
  if (profileError) return { error: profileError.message };

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
  return { ok: true, users: (data?.users || []).map((u) => ({ id: u.id, email: u.email })) };
}

// allow: true (grant), false (deny), or null (clear override — fall back
// to the role default).
export async function setUserPermissionOverride(userId, permissionKey, allow) {
  const { supabase, user } = await requireUser();
  const { data: allowedToManage } = await supabase.rpc("fn_has_permission", { perm_key: "users.manage" });
  if (!allowedToManage) return { error: "You don't have permission to manage permissions." };
  if (userId === user.id) return { error: "You can't change your own permissions from this screen." };

  const { data: perm } = await supabase.from("permissions").select("id").eq("key", permissionKey).maybeSingle();
  if (!perm) return { error: "Unknown permission." };

  if (allow === null) {
    const { error } = await supabase.from("user_permission_overrides").delete().eq("user_id", userId).eq("permission_id", perm.id);
    if (!error) await supabase.from("audit_logs").insert({ user_id: user.id, action: "USER_CHANGE", module: "permissions", record_id: userId, new_value: { permission: permissionKey, override: "cleared" } });
    revalidatePath(`/user-management/permissions/${userId}`);
    return { ok: !error, error: error?.message };
  }

  const { error } = await supabase.from("user_permission_overrides")
    .upsert({ user_id: userId, permission_id: perm.id, allow }, { onConflict: "user_id,permission_id" });
  if (!error) await supabase.from("audit_logs").insert({ user_id: user.id, action: "USER_CHANGE", module: "permissions", record_id: userId, new_value: { permission: permissionKey, override: allow } });
  revalidatePath(`/user-management/permissions/${userId}`);
  return { ok: !error, error: error?.message };
}

// Used by Select All / Clear All / Save so the whole grid commits as one
// round trip instead of one request per cell. updates: [{ permissionKey,
// allow: true|false|null }].
export async function bulkSetUserPermissionOverrides(userId, updates) {
  const { supabase, user } = await requireUser();
  const { data: allowedToManage } = await supabase.rpc("fn_has_permission", { perm_key: "users.manage" });
  if (!allowedToManage) return { error: "You don't have permission to manage permissions." };
  if (userId === user.id) return { error: "You can't change your own permissions from this screen." };
  if (!Array.isArray(updates) || updates.length === 0) return { ok: true };

  const { data: perms } = await supabase.from("permissions").select("id, key");
  const permByKey = new Map((perms || []).map((p) => [p.key, p.id]));

  const toDelete = updates.filter((u) => u.allow === null).map((u) => permByKey.get(u.permissionKey)).filter(Boolean);
  const toUpsert = updates.filter((u) => u.allow !== null && permByKey.has(u.permissionKey))
    .map((u) => ({ user_id: userId, permission_id: permByKey.get(u.permissionKey), allow: u.allow }));

  if (toDelete.length) {
    const { error } = await supabase.from("user_permission_overrides").delete().eq("user_id", userId).in("permission_id", toDelete);
    if (error) return { error: error.message };
  }
  if (toUpsert.length) {
    const { error } = await supabase.from("user_permission_overrides").upsert(toUpsert, { onConflict: "user_id,permission_id" });
    if (error) return { error: error.message };
  }

  await supabase.from("audit_logs").insert({ user_id: user.id, action: "USER_CHANGE", module: "permissions", record_id: userId, new_value: { bulk_update: updates.length } });
  revalidatePath(`/user-management/permissions/${userId}`);
  return { ok: true };
}

// "Reset" — drop every override for this user so their effective
// permissions become exactly their role's defaults again.
export async function resetUserPermissionOverrides(userId) {
  const { supabase, user } = await requireUser();
  const { data: allowedToManage } = await supabase.rpc("fn_has_permission", { perm_key: "users.manage" });
  if (!allowedToManage) return { error: "You don't have permission to manage permissions." };
  if (userId === user.id) return { error: "You can't change your own permissions from this screen." };

  const { error } = await supabase.from("user_permission_overrides").delete().eq("user_id", userId);
  if (!error) await supabase.from("audit_logs").insert({ user_id: user.id, action: "USER_CHANGE", module: "permissions", record_id: userId, new_value: { reset: true } });
  revalidatePath(`/user-management/permissions/${userId}`);
  return { ok: !error, error: error?.message };
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
