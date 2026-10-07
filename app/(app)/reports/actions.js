"use server";
// Server action behind the report Detail Drawer. Only async functions may
// be exported from a "use server" module — formatting helpers stay in
// lib/format.js / lib/ew/status.js (plain modules).
import { createClient } from "@/lib/supabase/server";
import { pkr, fmtDate, fmtDateTime } from "@/lib/format";
import { methodLabel } from "@/lib/ew/status";
import { findInvoiceByRef } from "@/lib/ew/docData";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const n = (v) => Number(v) || 0;

async function auditFor(supabase, ids) {
  const list = ids.filter(Boolean).map(String);
  if (!list.length) return [];
  const { data } = await supabase.from("audit_logs").select("action, module, created_at, new_value, old_value, profiles(full_name)")
    .in("record_id", list).order("created_at", { ascending: false }).limit(30);
  return (data || []).map((a) => {
    const reason = a.new_value?.reason || a.new_value?.void_reason || a.new_value?.difference_reason || "";
    return { action: `${String(a.action || "").replace(/_/g, " ")} · ${a.module || ""}`.trim(), at: a.created_at, by: a.profiles?.full_name || "", note: reason ? `Reason: ${reason}` : "" };
  });
}

function created(at, by, label = "Created") {
  return { action: label, at, by: by || "", note: "" };
}

export async function getRecordDetail(kind, id) {
  if (!UUID.test(String(id || ""))) return { error: "Invalid record." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Please sign in again." };

  switch (kind) {
    case "invoice": {
      const { data: i } = await supabase.from("invoices").select("*, customers(id, code, name, mobile, zones(name)), invoice_items(quantity, rate, amount, description, products(name)), creator:profiles!invoices_created_by_fkey(full_name), deliveries(id, delivery_no, delivery_items(delivered_qty, returned_qty))").eq("id", id).maybeSingle();
      if (!i) return { error: "Invoice not found or not accessible." };
      const d0 = Array.isArray(i.deliveries) ? i.deliveries[0] : i.deliveries;
      const { data: pays } = await supabase.from("payments").select("id, receipt_no, amount, method, payment_date").in("reference", [i.invoice_no, d0?.delivery_no].filter(Boolean)).eq("voided", false);
      const paid = (pays || []).reduce((a, p) => a + n(p.amount), 0);
      const d = Array.isArray(i.deliveries) ? i.deliveries[0] : i.deliveries;
      const delivered = (d?.delivery_items || []).reduce((a, x) => a + n(x.delivered_qty), 0);
      const returned = (d?.delivery_items || []).reduce((a, x) => a + n(x.returned_qty), 0);
      return {
        typeLabel: "Invoice", title: i.invoice_no, status: i.status,
        sections: [
          { title: "Transaction Details", fields: [{ label: "Invoice Date", value: fmtDate(i.invoice_date) }, { label: "Due Date", value: i.due_date ? fmtDate(i.due_date) : "On receipt" }, { label: "Amount", value: pkr(i.net_amount) }, { label: "Discount", value: pkr(i.discount) }] },
          { title: "Customer", fields: [{ label: "Customer", value: i.customers?.name }, { label: "Customer ID", value: i.customers?.code }, { label: "Phone", value: i.customers?.mobile }, { label: "Zone", value: i.customers?.zones?.name }] },
          { title: "Bottle Details", fields: [{ label: "Delivery", value: d?.delivery_no || "—" }, { label: "Bottles Delivered", value: d ? delivered : (i.invoice_items || []).reduce((a, x) => a + n(x.quantity), 0) }, { label: "Empty Returned", value: d ? returned : "—" }] },
          { title: "Payment", fields: [{ label: "Paid", value: pkr(paid) }, { label: "Balance on Invoice", value: pkr(n(i.net_amount) - paid) }, { label: "Receipts", value: (pays || []).map((p) => p.receipt_no).join(", ") || "None", wide: true }] },
          { title: "Entry", fields: [{ label: "Entered By", value: i.creator?.full_name }, { label: "Date / Time", value: fmtDateTime(i.created_at) }, { label: "Approval", value: i.status === "void" ? "Voided" : "Posted" }, { label: "Remarks", value: i.void_reason || "—", wide: true }] },
        ],
        lines: (i.invoice_items || []).map((x) => ({ label: `${x.products?.name || x.description || "Item"} × ${n(x.quantity)} @ ${pkr(x.rate)}`, value: pkr(x.amount) })), linesTitle: "Invoice Lines",
        links: [{ href: `/sales/${i.id}`, label: "View Invoice" }, ...(pays || []).map((p) => ({ href: `/payments/receipt/${p.id}`, label: `Receipt ${p.receipt_no || ""}` })), ...(i.customers?.id ? [{ href: `/customers/${i.customers.id}/statement`, label: "Customer Statement" }] : [])],
        audit: [...(await auditFor(supabase, [i.id])), created(i.created_at, i.creator?.full_name)],
        fullHref: `/sales/${i.id}`,
      };
    }
    case "payment": {
      const { data: p } = await supabase.from("payments").select("*, customers(id, code, name, mobile, zones(name)), collector:profiles!payments_received_by_fkey(full_name)").eq("id", id).maybeSingle();
      if (!p) return { error: "Payment not found or not accessible." };
      const inv = p.reference ? await findInvoiceByRef(supabase, p.reference) : null;
      return {
        typeLabel: "Payment Receipt", title: p.receipt_no || "Payment", status: p.voided ? "void" : "paid",
        sections: [
          { title: "Transaction Details", fields: [{ label: "Date", value: fmtDate(p.payment_date) }, { label: "Amount", value: pkr(p.amount) }, { label: "Mode", value: methodLabel(p.method) }, { label: "Reference", value: p.reference || "—" }] },
          { title: "Customer", fields: [{ label: "Customer", value: p.customers?.name }, { label: "Customer ID", value: p.customers?.code }, { label: "Phone", value: p.customers?.mobile }, { label: "Zone", value: p.customers?.zones?.name }] },
          { title: "Entry", fields: [{ label: "Collected By", value: p.collector?.full_name }, { label: "Date / Time", value: fmtDateTime(p.created_at) }, { label: "Approval", value: p.voided ? "Voided" : "Posted" }, { label: "Remarks", value: p.void_reason || p.notes || "—", wide: true }] },
        ],
        links: [{ href: `/payments/receipt/${p.id}`, label: "View Receipt" }, ...(inv ? [{ href: `/sales/${inv.id}`, label: `Invoice ${inv.invoice_no}` }] : []), ...(p.customers?.id ? [{ href: `/customers/${p.customers.id}/statement`, label: "Customer Statement" }] : [])],
        audit: [...(await auditFor(supabase, [p.id])), created(p.created_at, p.collector?.full_name, "Received")],
        fullHref: `/payments/receipt/${p.id}`,
      };
    }
    case "delivery": {
      const { data: d } = await supabase.from("deliveries").select("*, customers(id, code, name, mobile, zones(name)), rider:profiles!deliveries_rider_id_fkey(full_name), creator:profiles!deliveries_created_by_fkey(full_name), delivery_items(delivered_qty, returned_qty, expected_qty, unit_price, amount, products(name))").eq("id", id).maybeSingle();
      if (!d) return { error: "Delivery not found or not accessible." };
      const { data: inv } = await supabase.from("invoices").select("id, invoice_no, status").eq("delivery_id", d.id).maybeSingle();
      const items = d.delivery_items || [];
      return {
        typeLabel: "Delivery", title: d.delivery_no || "Delivery", status: d.status,
        sections: [
          { title: "Transaction Details", fields: [{ label: "Delivery Date", value: fmtDate(d.delivery_date) }, { label: "Amount", value: pkr(d.amount) }, { label: "Collected", value: pkr(d.amount_collected) }, { label: "Payment Mode", value: d.payment_method ? methodLabel(d.payment_method) : "—" }] },
          { title: "Customer", fields: [{ label: "Customer", value: d.customers?.name }, { label: "Customer ID", value: d.customers?.code }, { label: "Phone", value: d.customers?.mobile }, { label: "Zone", value: d.customers?.zones?.name }, { label: "Address", value: d.address_snapshot, wide: true }] },
          { title: "Bottle Details", fields: [{ label: "Scheduled", value: items.reduce((a, x) => a + n(x.expected_qty), 0) }, { label: "Delivered", value: items.reduce((a, x) => a + n(x.delivered_qty), 0) }, { label: "Empty Returned", value: items.reduce((a, x) => a + n(x.returned_qty), 0) }] },
          { title: "Entry", fields: [{ label: "Delivery Boy", value: d.rider?.full_name }, { label: "Entered By", value: d.creator?.full_name }, { label: "Delivered At", value: d.delivered_at ? fmtDateTime(d.delivered_at) : "—" }, { label: "Invoice", value: inv?.invoice_no || "Not invoiced" }, { label: "Remarks", value: [d.rider_remarks, d.customer_remarks, d.void_reason].filter(Boolean).join(" · ") || "—", wide: true }] },
        ],
        lines: items.map((x) => ({ label: `${x.products?.name || "Item"} · ${n(x.delivered_qty)} delivered / ${n(x.returned_qty)} returned @ ${pkr(x.unit_price)}`, value: pkr(x.amount) })), linesTitle: "Delivery Lines",
        links: [{ href: `/deliveries/slip/${d.id}`, label: "Delivery Slip" }, ...(inv ? [{ href: `/sales/${inv.id}`, label: `Invoice ${inv.invoice_no}` }] : []), ...(d.customers?.id ? [{ href: `/customers/${d.customers.id}/statement`, label: "Customer Statement" }] : [])],
        audit: [...(await auditFor(supabase, [d.id])), created(d.created_at, d.creator?.full_name)],
        fullHref: `/deliveries/slip/${d.id}`,
      };
    }
    case "expense": {
      const { data: e } = await supabase.from("expenses").select("*, expense_categories(name), submitter:profiles!expenses_submitted_by_fkey(full_name), employee:profiles!expenses_employee_id_fkey(full_name)").eq("id", id).maybeSingle();
      if (!e) return { error: "Expense not found or not accessible." };
      let approver = null;
      if (e.approved_by) { const { data: a } = await supabase.from("profiles").select("full_name").eq("id", e.approved_by).maybeSingle(); approver = a?.full_name; }
      return {
        typeLabel: "Expense", title: e.expense_no || "Expense", status: e.voided ? "void" : e.status,
        sections: [
          { title: "Transaction Details", fields: [{ label: "Date", value: fmtDate(e.expense_date) }, { label: "Category", value: e.expense_categories?.name }, { label: "Amount", value: pkr(e.amount) }, { label: "Payment Mode", value: methodLabel(e.payment_method) }, { label: "Description", value: e.description, wide: true }] },
          { title: "Entry", fields: [{ label: "Entered By", value: e.submitter?.full_name }, { label: "Employee", value: e.employee?.full_name || "—" }, { label: "Date / Time", value: fmtDateTime(e.created_at) }, { label: "Approval", value: approver ? `Approved by ${approver}${e.approved_at ? ` · ${fmtDateTime(e.approved_at)}` : ""}` : e.status }, { label: "Receipt Ref.", value: e.receipt_reference || "—" }, { label: "Remarks", value: e.void_reason || "—", wide: true }] },
        ],
        links: [{ href: `/expenses/voucher/${e.id}`, label: "Expense Voucher" }],
        audit: [...(await auditFor(supabase, [e.id])), created(e.created_at, e.submitter?.full_name)],
        fullHref: `/expenses/voucher/${e.id}`,
      };
    }
    case "customer": {
      const [{ data: c }, { data: bal }, { data: bottles }, { data: lastPay }] = await Promise.all([
        supabase.from("customers").select("*, zones(name)").eq("id", id).maybeSingle(),
        supabase.from("v_customer_balance").select("balance").eq("customer_id", id).maybeSingle(),
        supabase.from("v_customer_bottle_balance").select("bottles_with_customer").eq("customer_id", id),
        supabase.from("payments").select("id, receipt_no, amount, payment_date").eq("customer_id", id).eq("voided", false).order("payment_date", { ascending: false }).limit(1).maybeSingle(),
      ]);
      if (!c) return { error: "Customer not found or not accessible." };
      return {
        typeLabel: "Customer", title: `${c.code ? `${c.code} · ` : ""}${c.name}`, status: n(bal?.balance) > 0 ? "payment_due" : "clear",
        sections: [
          { title: "Customer", fields: [{ label: "Phone", value: c.mobile }, { label: "Zone", value: c.zones?.name }, { label: "Address", value: [c.building, c.address].filter(Boolean).join(", "), wide: true }] },
          { title: "Account", fields: [{ label: "Current Outstanding", value: pkr(bal?.balance) }, { label: "Credit Limit", value: pkr(c.credit_limit) }, { label: "Bottle Balance", value: (bottles || []).reduce((a, b) => a + n(b.bottles_with_customer), 0) }, { label: "Last Payment", value: lastPay ? `${pkr(lastPay.amount)} on ${fmtDate(lastPay.payment_date)}` : "No payment yet" }] },
        ],
        links: [{ href: `/customers/${c.id}/statement`, label: "Statement" }, { href: `/customers/${c.id}/ledger`, label: "Ledger" }, ...(lastPay ? [{ href: `/payments/receipt/${lastPay.id}`, label: "Last Receipt" }] : [])],
        audit: await auditFor(supabase, [c.id]),
        fullHref: `/customers/${c.id}`,
      };
    }
    case "inventory_item": {
      const [{ data: it }, { data: moves }] = await Promise.all([
        supabase.from("inventory_items").select("*").eq("id", id).maybeSingle(),
        supabase.from("inventory_movements").select("movement_type, quantity, unit_cost, notes, created_at").eq("item_id", id).order("created_at", { ascending: false }).limit(15),
      ]);
      if (!it) return { error: "Item not found or not accessible." };
      return {
        typeLabel: "Inventory Item", title: it.name, status: it.is_active ? "normal" : "void",
        sections: [{ title: "Item", fields: [{ label: "Category", value: it.category }, { label: "Unit", value: it.unit }, { label: "Reorder Level", value: it.reorder_level }] }],
        lines: (moves || []).map((m) => ({ label: `${fmtDate(m.created_at)} · ${String(m.movement_type).replace(/_/g, " ")}${m.notes ? ` · ${m.notes}` : ""}`, value: `${n(m.quantity)} ${it.unit || ""}` })), linesTitle: "Recent Movements",
        audit: await auditFor(supabase, [it.id]),
        fullHref: "/inventory",
      };
    }
    case "closing": {
      const { data: c } = await supabase.from("daily_closings").select("*, closer:profiles!daily_closings_closed_by_fkey(full_name), approver:profiles!daily_closings_approved_by_fkey(full_name)").eq("id", id).maybeSingle();
      if (!c) return { error: "Daily closing not found or not accessible." };
      return {
        typeLabel: "Daily Closing", title: `${c.closing_no} · ${fmtDate(c.close_date)}`, status: c.status === "closed" ? "pending" : c.status,
        sections: [
          { title: "Cash", fields: [{ label: "Opening Cash", value: pkr(c.opening_cash) }, { label: "Cash Collections", value: pkr(c.cash_collections) }, { label: "Cash Expenses", value: pkr(c.cash_expenses) }, { label: "Expected Cash", value: pkr(c.expected_cash) }, { label: "Actual Cash", value: pkr(c.actual_cash) }, { label: "Difference", value: pkr(c.difference) }, { label: "Explanation", value: c.difference_reason || "—", wide: true }] },
          { title: "Day Totals", fields: [{ label: "Sales", value: pkr(c.sales_total) }, { label: "Collections", value: pkr(c.collections_total) }, { label: "Expenses", value: pkr(c.expenses_total) }, { label: "Deliveries", value: c.deliveries_count }, { label: "Bottles Delivered", value: c.bottles_delivered }, { label: "Empty Returned", value: c.empty_returned }, { label: "Missed", value: c.missed_deliveries }] },
          { title: "Approval", fields: [{ label: "Closed By", value: c.closer?.full_name }, { label: "Closed At", value: fmtDateTime(c.closed_at) }, { label: c.status === "rejected" ? "Rejected By" : "Approved By", value: c.approver?.full_name || "Awaiting approval" }, { label: "Reviewed At", value: c.approved_at ? fmtDateTime(c.approved_at) : "—" }, { label: "Notes", value: c.notes || "—", wide: true }] },
        ],
        links: [{ href: `/accounting/daily-closing/${c.id}`, label: "Daily Closing Statement" }],
        audit: await auditFor(supabase, [c.id]),
        fullHref: `/accounting/daily-closing/${c.id}`,
      };
    }
    case "adjustment": {
      const { data: a } = await supabase.from("customer_adjustments").select("*, customers(id, code, name), creator:profiles!customer_adjustments_created_by_fkey(full_name)").eq("id", id).maybeSingle();
      if (!a) return { error: "Adjustment not found or not accessible." };
      return {
        typeLabel: a.adjustment_type === "credit" ? "Credit Note" : "Debit Note", title: a.adjustment_no, status: a.status,
        sections: [
          { title: "Transaction Details", fields: [{ label: "Date", value: fmtDate(a.adjustment_date) }, { label: "Amount", value: pkr(a.amount) }, { label: "Reference", value: a.reference || "—" }, { label: "Reason", value: a.reason, wide: true }] },
          { title: "Customer", fields: [{ label: "Customer", value: a.customers?.name }, { label: "Customer ID", value: a.customers?.code }] },
          { title: "Entry", fields: [{ label: "Entered By", value: a.creator?.full_name }, { label: "Date / Time", value: fmtDateTime(a.created_at) }] },
        ],
        links: [{ href: `/customers/adjustments/${a.id}`, label: "View Document" }, ...(a.customers?.id ? [{ href: `/customers/${a.customers.id}/statement`, label: "Customer Statement" }] : [])],
        audit: await auditFor(supabase, [a.id]),
        fullHref: `/customers/adjustments/${a.id}`,
      };
    }
    default:
      return { error: "No detail view for this record type." };
  }
}
