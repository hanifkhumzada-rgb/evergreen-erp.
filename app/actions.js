"use server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

async function requireUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return { supabase, user };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function createCustomer(formData) {
  const { supabase, user } = await requireUser();
  const payload = {
    name: formData.get("name"),
    phone: formData.get("phone"),
    zone_id: formData.get("zone_id") || null,
    customer_type: formData.get("customer_type"),
    rate: Number(formData.get("rate")) || 0,
    regular_qty: Number(formData.get("regular_qty")) || 1,
    address: formData.get("address") || "",
    whatsapp: formData.get("phone"),
    created_by: user.id,
  };
  const { error } = await supabase.from("customers").insert(payload);
  if (error) return { error: error.message };
  revalidatePath("/customers");
  return { ok: true };
}

export async function createSale(formData) {
  const { supabase, user } = await requireUser();
  const customerId = formData.get("customer_id");
  const qty = Number(formData.get("qty"));
  const paid = Number(formData.get("paid")) || 0;

  const { data: customer } = await supabase.from("customers").select("rate").eq("id", customerId).single();
  if (!customer) return { error: "Customer not found" };
  const total = qty * customer.rate;

  const { data: invNo } = await supabase.rpc("next_invoice_no");

  const { error } = await supabase.from("sales").insert({
    invoice_no: invNo,
    customer_id: customerId,
    qty,
    unit_price: customer.rate,
    total,
    paid,
    balance: total - paid,
    payment_method: formData.get("payment_method"),
    payment_status: paid >= total ? "Paid" : paid === 0 ? "Pending" : "Partially Paid",
    created_by: user.id,
  });
  if (error) return { error: error.message };
  revalidatePath("/sales");
  revalidatePath("/dashboard");
  revalidatePath("/customers");
  return { ok: true };
}

export async function createPayment(formData) {
  const { supabase, user } = await requireUser();
  const { error } = await supabase.from("payments").insert({
    customer_id: formData.get("customer_id"),
    amount: Number(formData.get("amount")),
    method: formData.get("method"),
    created_by: user.id,
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
  const { error } = await supabase.from("expenses").insert({
    category: formData.get("category"),
    description: formData.get("description"),
    amount: Number(formData.get("amount")),
    method: formData.get("method"),
    created_by: user.id,
  });
  if (error) return { error: error.message };
  revalidatePath("/expenses");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function markDelivered(deliveryId, emptyReceived) {
  const { supabase } = await requireUser();
  const { data: d } = await supabase.from("deliveries").select("qty, customer_id, customers(rate)").eq("id", deliveryId).single();
  if (!d) return { error: "Delivery not found" };
  const { error } = await supabase.from("deliveries").update({
    status: "Delivered",
    empty_received: emptyReceived,
    cash_collected: d.qty * (d.customers?.rate || 0),
    updated_at: new Date().toISOString(),
  }).eq("id", deliveryId);
  if (error) return { error: error.message };
  revalidatePath("/deliveries");
  revalidatePath("/bottles");
  return { ok: true };
}

export async function closeDay(formData) {
  const { supabase, user } = await requireUser();
  const closeDate = formData.get("close_date");
  const openingCash = Number(formData.get("opening_cash")) || 0;
  const actualCash = Number(formData.get("actual_cash"));

  const { data: sales } = await supabase.from("sales").select("total, paid").eq("sale_date", closeDate);
  const { data: payments } = await supabase.from("payments").select("amount").eq("pay_date", closeDate);
  const { data: expenses } = await supabase.from("expenses").select("amount").eq("exp_date", closeDate);

  const salesTotal = (sales || []).reduce((a, s) => a + Number(s.total), 0);
  const collectionsTotal = (sales || []).reduce((a, s) => a + Number(s.paid), 0) + (payments || []).reduce((a, p) => a + Number(p.amount), 0);
  const expensesTotal = (expenses || []).reduce((a, e) => a + Number(e.amount), 0);
  const expectedCash = openingCash + collectionsTotal - expensesTotal;
  const difference = actualCash - expectedCash;

  const { error } = await supabase.from("daily_closings").upsert({
    close_date: closeDate, opening_cash: openingCash, sales_total: salesTotal,
    collections_total: collectionsTotal, expenses_total: expensesTotal,
    expected_cash: expectedCash, actual_cash: actualCash, difference,
    status: "Closed", closed_by: user.id, closed_at: new Date().toISOString(),
  }, { onConflict: "close_date" });
  if (error) return { error: error.message };

  await supabase.from("audit_logs").insert({ user_id: user.id, action: "CLOSE_DAY", module: "daily_closings", new_value: { close_date: closeDate, difference } });
  revalidatePath("/accounting/daily-closing");
  return { ok: true, difference, expectedCash };
}

export async function addVehicle(formData) {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("vehicles").insert({
    vehicle_no: formData.get("vehicle_no"),
    vehicle_type: formData.get("vehicle_type"),
    driver_employee_id: formData.get("driver_employee_id") || null,
  });
  if (error) return { error: error.message };
  revalidatePath("/fleet");
  return { ok: true };
}

export async function addVehicleExpense(formData) {
  const { supabase, user } = await requireUser();
  const { error } = await supabase.from("vehicle_expenses").insert({
    vehicle_id: formData.get("vehicle_id"),
    category: formData.get("category"),
    amount: Number(formData.get("amount")),
    notes: formData.get("notes"),
    created_by: user.id,
  });
  if (error) return { error: error.message };
  revalidatePath("/fleet");
  return { ok: true };
}

function monthStartISO() { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10); }
function todayISO2() { return new Date().toISOString().slice(0, 10); }

export async function askAI(question) {
  const { supabase, user } = await requireUser();
  const { data: profile } = await supabase.from("profiles").select("role, full_name").eq("id", user.id).single();
  const role = profile.role;
  const financeAllowed = ["owner", "accountant"].includes(role);
  const ql = question.toLowerCase();

  const restricted = () => ({ text: "You don't have permission to access this information. Ask an Owner or Accountant." });

  if ((ql.includes("net profit") || ql.includes("profit") || ql.includes("revenue") || ql.includes("receivable") || ql.includes("payable")) && !financeAllowed) {
    return restricted();
  }

  if (ql.includes("net profit") || (ql.includes("profit") && ql.includes("why"))) {
    const from = monthStartISO(); const to = todayISO2();
    const { data: lines } = await supabase.from("journal_lines").select("debit, credit, chart_of_accounts(type), journal_entries!inner(entry_date)").gte("journal_entries.entry_date", from).lte("journal_entries.entry_date", to);
    const sum = (t, dir) => (lines || []).filter((l) => l.chart_of_accounts?.type === t).reduce((a, l) => a + (dir === "credit" ? Number(l.credit) - Number(l.debit) : Number(l.debit) - Number(l.credit)), 0);
    const income = sum("INCOME", "credit"), cogs = sum("COGS", "debit"), exp = sum("EXPENSE", "debit");
    const net = income - cogs - exp;
    return { text: `This month so far: revenue ${pkrFmt(income)}, COGS ${pkrFmt(cogs)}, expenses ${pkrFmt(exp)} → net profit ${pkrFmt(net)}. This is a heuristic figure from your live journal, not a finalized statement.` };
  }
  if (ql.includes("receivable") || ql.includes("owe") || ql.includes("outstanding")) {
    const { data: customers } = await supabase.from("customers").select("name, balance").order("balance", { ascending: false }).limit(5);
    const top = (customers || []).filter((c) => c.balance > 0);
    if (!top.length) return { text: "No outstanding receivables right now." };
    return { text: `Top receivables: ${top.map((c) => `${c.name} (${pkrFmt(c.balance)})`).join(", ")}.` };
  }
  if (ql.includes("inventory value") || ql.includes("stock value")) {
    const { data: products } = await supabase.from("products").select("name, stock, cost");
    const total = (products || []).reduce((a, p) => a + p.stock * Number(p.cost), 0);
    return { text: `Inventory value at cost: ${pkrFmt(total)}, across ${(products || []).length} products.` };
  }
  if (ql.includes("collect") && (ql.includes("today") || ql.includes("day"))) {
    const today = todayISO2();
    const { data: sales } = await supabase.from("sales").select("paid").eq("sale_date", today);
    const { data: payments } = await supabase.from("payments").select("amount").eq("pay_date", today);
    const total = (sales || []).reduce((a, s) => a + Number(s.paid), 0) + (payments || []).reduce((a, p) => a + Number(p.amount), 0);
    return { text: `Collected today: ${pkrFmt(total)}.` };
  }
  if (ql.includes("closing difference") || ql.includes("closing")) {
    const { data: closing } = await supabase.from("daily_closings").select("*").order("close_date", { ascending: false }).limit(1).maybeSingle();
    if (!closing) return { text: "No daily closing has been recorded yet." };
    return { text: `Last closing (${closing.close_date}): expected ${pkrFmt(closing.expected_cash)}, actual ${pkrFmt(closing.actual_cash)}, difference ${pkrFmt(closing.difference)}.` };
  }
  if (ql.includes("bottle liability") || ql.includes("bottle") && ql.includes("liab")) {
    const { data: customers } = await supabase.from("customers").select("bottles_delivered, bottles_returned");
    const withCustomers = (customers || []).reduce((a, c) => a + (c.bottles_delivered - c.bottles_returned), 0);
    return { text: `${withCustomers} bottles are currently with customers, valued at roughly ${pkrFmt(withCustomers * 800)} at replacement cost.` };
  }
  if (ql.includes("zone") && ql.includes("revenue")) {
    const { data: sales } = await supabase.from("sales").select("total, customers(zone_id, zones(name))");
    const m = {};
    (sales || []).forEach((s) => { const z = s.customers?.zones?.name || "Unassigned"; m[z] = (m[z] || 0) + Number(s.total); });
    const sorted = Object.entries(m).sort((a, b) => b[1] - a[1]);
    if (!sorted.length) return { text: "Insufficient data to answer accurately." };
    return { text: `Top zone by revenue: ${sorted[0][0]} (${pkrFmt(sorted[0][1])}).` };
  }
  if (ql.includes("vehicle") && ql.includes("cost")) {
    const { data: exp } = await supabase.from("vehicle_expenses").select("amount, vehicles(vehicle_no)");
    const m = {};
    (exp || []).forEach((e) => { const v = e.vehicles?.vehicle_no || "Unknown"; m[v] = (m[v] || 0) + Number(e.amount); });
    const sorted = Object.entries(m).sort((a, b) => b[1] - a[1]);
    if (!sorted.length) return { text: "No vehicle expenses recorded yet." };
    return { text: `Highest-cost vehicle: ${sorted[0][0]} (${pkrFmt(sorted[0][1])} total).` };
  }
  if (ql.includes("driver") && ql.includes("best")) {
    const { data: deliveries } = await supabase.from("deliveries").select("status, employees(name)");
    const m = {};
    (deliveries || []).forEach((d) => { const n = d.employees?.name; if (!n) return; m[n] = m[n] || { done: 0, total: 0 }; m[n].total++; if (d.status === "Delivered") m[n].done++; });
    const sorted = Object.entries(m).sort((a, b) => (b[1].done / b[1].total) - (a[1].done / a[1].total));
    if (!sorted.length) return { text: "Insufficient data to answer accurately." };
    return { text: `Best performing driver: ${sorted[0][0]} (${sorted[0][1].done}/${sorted[0][1].total} deliveries completed).` };
  }
  if (ql.includes("inactive")) {
    const { data: customers } = await supabase.from("customers").select("name, status").neq("status", "Active");
    if (!customers?.length) return { text: "No inactive or at-risk customers right now." };
    return { text: `Inactive/at-risk: ${customers.map((c) => c.name).join(", ")}.` };
  }
  if (ql.includes("stock") || ql.includes("reorder")) {
    const { data: products } = await supabase.from("products").select("name, stock, min_stock");
    const low = (products || []).filter((p) => p.stock < p.min_stock);
    if (!low.length) return { text: "All products are above their reorder level." };
    return { text: `Reorder recommended: ${low.map((p) => p.name).join(", ")}.` };
  }
  if (ql.includes("sold") || ql.includes("bottles")) {
    const { data: sales } = await supabase.from("sales").select("qty");
    const total = (sales || []).reduce((a, s) => a + s.qty, 0);
    return { text: `${total} bottles sold across all recorded invoices.` };
  }
  return { text: "Insufficient data to answer accurately. Try asking about receivables, inventory value, today's collections, or bottle liability." };
}
function pkrFmt(n) { return "PKR " + Math.round(Number(n) || 0).toLocaleString("en-PK"); }

export async function bulkImportCustomers(rows) {
  const { supabase, user } = await requireUser();
  const payload = rows.map((r) => ({
    name: r.Name || r.name || "Unnamed",
    phone: String(r.Phone || r.phone || ""),
    address: r.Address || "",
    customer_type: r.Type || "Household",
    rate: Number(r.Rate) || 120,
    regular_qty: Number(r.Qty) || 2,
    whatsapp: String(r.Phone || r.phone || ""),
    created_by: user.id,
  })).filter((r) => r.phone);
  const { data, error } = await supabase.from("customers").insert(payload).select("id");
  revalidatePath("/customers");
  return { ok: !error, imported: data?.length || 0, failed: payload.length - (data?.length || 0), error: error?.message };
}
