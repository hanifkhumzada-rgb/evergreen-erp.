import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import SimpleListDocument from "@/lib/pdf/SimpleListDocument";
import { getBusinessBranding } from "@/lib/pdf/business";
import { pdfContentDisposition } from "@/lib/pdf/response";
import { getPortalSession } from "@/lib/portal/session";
import { fetchAll } from "@/lib/fetchAll";
import { portalQr } from "@/lib/pdf/qr";
import { pkr, fmtDate } from "@/lib/format";
import {
  portalDeliveryFilters, portalDeliveriesQuery, portalPaymentFilters, portalPaymentsQuery, deliveryItemsText, PORTAL_METHOD_LABEL,
} from "@/lib/portal/listQueries";

// Customer Portal list PDFs (My Deliveries / Payments) with the same
// filters as the screen. Scoped to the signed-in customer's own id.
export async function GET(request) {
  const { supabase, user, customerId } = await getPortalSession();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });
  if (!customerId) return new NextResponse("Not a customer account", { status: 403 });

  const sp = Object.fromEntries(new URL(request.url).searchParams);
  const kind = sp.kind === "payments" ? "payments" : "deliveries";
  const [branding, { data: customer }] = await Promise.all([
    getBusinessBranding(supabase),
    supabase.from("customers").select("name, code").eq("id", customerId).single(),
  ]);
  const who = customer ? `${customer.name}${customer.code ? ` (${customer.code})` : ""}` : "";

  const qr = await portalQr(request, `/portal/${kind}`, { title: "Open in My Evergreen Water", text: "Scan to see this list, always up to date, in your Customer Portal." });
  let doc;
  if (kind === "deliveries") {
    const f = portalDeliveryFilters(sp);
    const { data } = await fetchAll(() => portalDeliveriesQuery(supabase, customerId, f), { label: "portal deliveries pdf" });
    const qty = data.reduce((a, d) => a + (d.delivery_items || []).reduce((s, i) => s + Number(i.delivered_qty || 0), 0), 0);
    const amount = data.filter((d) => d.status === "delivered").reduce((a, d) => a + Number(d.amount || 0), 0);
    doc = (
      <SimpleListDocument
        title="My Deliveries" branding={branding} qr={qr}
        meta={`${who}\n${f.month || "All months"}${f.status !== "all" ? ` · ${f.status}` : ""}`}
        stats={[{ label: "DELIVERIES", value: data.length }, { label: "BOTTLES DELIVERED", value: qty, tone: "aqua" }, { label: "DELIVERED AMOUNT", value: pkr(amount), tone: "green" }]}
        columns={[
          { key: "ref", label: "Reference", width: "20%", bold: true }, { key: "date", label: "Date", width: "16%" },
          { key: "status", label: "Status", width: "14%" }, { key: "items", label: "Items", width: "32%" },
          { key: "amount", label: "Amount", width: "18%", align: "right", bold: true },
        ]}
        rows={data.map((d) => ({ ref: d.delivery_no, date: fmtDate(d.delivery_date), status: String(d.status).replaceAll("_", " "), items: deliveryItemsText(d) || "—", amount: pkr(d.amount) }))}
        emptyText="No deliveries match this filter."
      />
    );
  } else {
    const f = portalPaymentFilters(sp);
    const { data } = await fetchAll(() => portalPaymentsQuery(supabase, customerId, f), { label: "portal payments pdf" });
    const total = data.reduce((a, p) => a + Number(p.amount || 0), 0);
    doc = (
      <SimpleListDocument
        title="My Payments" branding={branding} qr={qr} meta={`${who}\n${f.month || "All months"}`}
        stats={[{ label: "PAYMENTS", value: data.length }, { label: "TOTAL PAID", value: pkr(total), tone: "green" }]}
        columns={[
          { key: "receipt", label: "Receipt", width: "22%", bold: true }, { key: "date", label: "Date", width: "18%" },
          { key: "method", label: "Method", width: "18%" }, { key: "reference", label: "Reference", width: "24%" },
          { key: "amount", label: "Amount", width: "18%", align: "right", bold: true },
        ]}
        rows={data.map((p) => ({ receipt: p.receipt_no || "—", date: fmtDate(p.payment_date), method: PORTAL_METHOD_LABEL[p.method] || p.method, reference: p.reference || "—", amount: pkr(p.amount) }))}
        emptyText="No payments match this filter."
      />
    );
  }

  const buffer = await renderToBuffer(doc);
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": pdfContentDisposition(request, `my-${kind}-${new Date().toISOString().slice(0, 10)}.pdf`),
      "Cache-Control": "private, no-store",
    },
  });
}
