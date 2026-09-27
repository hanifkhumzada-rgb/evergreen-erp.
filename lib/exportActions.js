"use server";

// "Download Excel" for server-paginated lists: returns EVERY row matching
// the list's current filters (not just the visible page). Runs as the
// signed-in user, so RLS limits the rows exactly as on screen.
import { createClient } from "@/lib/supabase/server";
import { fetchAll } from "@/lib/fetchAll";
import {
  CUSTOMER_LIST_COLUMNS, applyCustomerFilters, applyPaymentFilters, applyInvoiceFilters,
  applyExpenseFilters, applyAuditFilters, applyJournalFilters, matchingCustomerIds,
} from "@/lib/listQueries";

const STATUS_TEXT = { active: "Active", inactive: "Inactive", on_hold: "On Hold", blacklisted: "Blacklisted", archived: "Archived" };

export async function exportCustomerRows(filters) {
  const supabase = await createClient();
  const [{ data: customers }, { data: balances }] = await Promise.all([
    fetchAll(() => applyCustomerFilters(supabase.from("customers").select(CUSTOMER_LIST_COLUMNS), filters).order("created_at", { ascending: false }).order("id"), { label: "export customers" }),
    fetchAll(() => supabase.from("v_customer_balance").select("customer_id, balance").order("customer_id"), { label: "export balances" }),
  ]);
  const bal = Object.fromEntries((balances || []).map((b) => [b.customer_id, Number(b.balance)]));
  return customers.map((c) => ({
    "Customer ID": c.code, Name: c.name, Phone: c.mobile, Building: c.building, Address: c.address, Area: c.area,
    Zone: c.zones?.name, Type: c.customer_type, Balance: bal[c.id] || 0, Status: STATUS_TEXT[c.status] || (c.is_active ? "Active" : "Inactive"),
  }));
}

export async function exportPaymentRows(filters) {
  const supabase = await createClient();
  const ids = filters.q ? await matchingCustomerIds(supabase, filters.q) : null;
  const { data } = await fetchAll(() => applyPaymentFilters(
    supabase.from("payments").select("id, receipt_no, payment_date, amount, method, reference, voided, customers(name, code), profiles!payments_received_by_fkey(full_name)"), filters, ids,
  ).order("payment_date", { ascending: false }).order("id"), { label: "export payments" });
  return data.map((p) => ({
    Receipt: p.receipt_no, Date: p.payment_date, Customer: p.customers?.name, "Customer ID": p.customers?.code, Amount: Number(p.amount),
    Method: p.method, Reference: p.reference || "", "Received By": p.profiles?.full_name || "", Status: p.voided ? "Voided" : "Active",
  }));
}

export async function exportInvoiceRows(filters) {
  const supabase = await createClient();
  const ids = filters.q ? await matchingCustomerIds(supabase, filters.q) : null;
  const { data } = await fetchAll(() => applyInvoiceFilters(
    supabase.from("invoices").select("id, invoice_no, invoice_date, net_amount, status, customers(name), invoice_items(quantity)"), filters, ids,
  ).order("created_at", { ascending: false }).order("id"), { label: "export invoices" });
  return data.map((s) => ({
    Invoice: s.invoice_no, Date: s.invoice_date, Customer: s.customers?.name,
    Qty: (s.invoice_items || []).reduce((a, i) => a + Number(i.quantity || 0), 0), Total: Number(s.net_amount), Status: s.status,
  }));
}

export async function exportExpenseRows(filters) {
  const supabase = await createClient();
  const { data } = await fetchAll(() => applyExpenseFilters(
    supabase.from("expenses").select("id, expense_no, expense_date, description, amount, payment_method, status, receipt_reference, expense_categories(name)"), filters,
  ).order("expense_date", { ascending: false }).order("id"), { label: "export expenses" });
  return data.map((e) => ({
    "Expense #": e.expense_no, Date: e.expense_date, Category: e.expense_categories?.name, Description: e.description,
    Amount: Number(e.amount), Method: e.payment_method, Receipt: e.receipt_reference || "", Status: e.status,
  }));
}

export async function exportAuditRows(filters) {
  const supabase = await createClient();
  const { data } = await fetchAll(() => applyAuditFilters(
    supabase.from("audit_logs").select("id, created_at, action, module, record_id, profiles(full_name)"), filters,
  ).order("created_at", { ascending: false }).order("id"), { label: "export audit" });
  return data.map((l) => ({ When: l.created_at, User: l.profiles?.full_name || "", Action: l.action, Module: l.module, Record: l.record_id || "" }));
}

// One row per journal line, so debits/credits reconcile in Excel.
export async function exportJournalRows(filters) {
  const supabase = await createClient();
  const { data } = await fetchAll(() => applyJournalFilters(
    supabase.from("journal_entries").select("id, entry_no, entry_date, reference, description, source_module, journal_lines(debit, credit, chart_of_accounts(code, name))"), filters,
  ).order("entry_date", { ascending: false }).order("id"), { label: "export journal" });
  return data.flatMap((je) => (je.journal_lines || []).map((l) => ({
    Entry: je.entry_no, Date: je.entry_date, Reference: je.reference || "", Description: je.description || "", Source: je.source_module || "",
    Account: `${l.chart_of_accounts?.code || ""} ${l.chart_of_accounts?.name || ""}`.trim(), Debit: Number(l.debit || 0), Credit: Number(l.credit || 0),
  })));
}
