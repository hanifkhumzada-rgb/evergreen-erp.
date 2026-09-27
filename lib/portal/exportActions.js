"use server";

// Customer Portal "Download Excel": every row matching the current filters,
// for the signed-in customer only (session customer id + RLS).
import { requirePortalCustomer } from "@/lib/portal/session";
import { fetchAll } from "@/lib/fetchAll";
import {
  portalDeliveriesQuery, portalPaymentsQuery, deliveryItemsText, PORTAL_METHOD_LABEL,
} from "@/lib/portal/listQueries";

export async function exportPortalDeliveries(filters) {
  const { supabase, customerId } = await requirePortalCustomer();
  const { data } = await fetchAll(() => portalDeliveriesQuery(supabase, customerId, filters), { label: "portal deliveries export" });
  return data.map((d) => ({
    Reference: d.delivery_no, Date: d.delivery_date, Status: String(d.status).replaceAll("_", " "),
    Items: deliveryItemsText(d),
    Delivered: (d.delivery_items || []).reduce((a, i) => a + Number(i.delivered_qty || 0), 0),
    Returned: (d.delivery_items || []).reduce((a, i) => a + Number(i.returned_qty || 0), 0),
    Amount: Number(d.amount || 0),
  }));
}

export async function exportPortalPayments(filters) {
  const { supabase, customerId } = await requirePortalCustomer();
  const { data } = await fetchAll(() => portalPaymentsQuery(supabase, customerId, filters), { label: "portal payments export" });
  return data.map((p) => ({
    Receipt: p.receipt_no, Date: p.payment_date, Method: PORTAL_METHOD_LABEL[p.method] || p.method, Reference: p.reference || "", Amount: Number(p.amount || 0),
  }));
}
