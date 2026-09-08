import { View, Text, Image } from "@react-pdf/renderer";
import { PdfShell } from "./DocumentChrome";
import { table, statTone } from "./tableStyles";
import { COLORS } from "./theme";
import { pkr, fmtDate } from "@/lib/format";

const STATUS_LABEL = { paid: "Paid", partially_paid: "Partially Paid", sent: "Pending", draft: "Draft", overdue: "Overdue", void: "Void" };
const STATUS_TONE = { paid: "green", partially_paid: "amber", sent: "coral", draft: "navy", overdue: "coral", void: "coral" };

// Premium Sales Invoice layout — Bill To card, Sr#/Product/Bottle
// Size/Qty/Rate/Discount/Amount item table, a full balance-carry summary
// (Subtotal → Discount → Previous Balance → Current Invoice Amount →
// Amount Paid → Outstanding Balance, with Outstanding/Total Payable
// visually prominent), and a footer with payment details, terms, notes,
// signature/stamp areas — everything the brief's section 3 asked for.
// businessName/address-only usage was retired with the old layout; every
// bit of company identity now comes from `branding` via the shared header.
export default function InvoiceDocument({ invoice, customer, items, paid, previousBalance, newBalance, branding }) {
  const statusTone = STATUS_TONE[invoice.status] || "navy";
  return (
    <PdfShell
      title="Sales Invoice"
      meta={`Invoice No: ${invoice.invoice_no}\nDate: ${fmtDate(invoice.invoice_date)}\nDue: ${invoice.due_date ? fmtDate(invoice.due_date) : "—"}\nStatus: ${STATUS_LABEL[invoice.status] || invoice.status}`}
      branding={branding}
    >
      <View style={{ backgroundColor: COLORS.foam, borderRadius: 8, padding: 12, marginBottom: 16, flexDirection: "row", justifyContent: "space-between" }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 7, fontFamily: "Helvetica-Bold", color: COLORS.slate, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 3 }}>Bill To</Text>
          <Text style={{ fontSize: 14, fontFamily: "Helvetica-Bold", color: COLORS.ink }}>{customer?.name}</Text>
          <Text style={{ fontSize: 8, color: COLORS.slate, marginTop: 2 }}>Client ID: {customer?.code || "—"}</Text>
          <Text style={{ fontSize: 8.5, color: COLORS.ink, marginTop: 4 }}>
            {[customer?.mobile, customer?.address].filter(Boolean).join("   ·   ")}
          </Text>
          {customer?.zones?.name && <Text style={{ fontSize: 8, color: COLORS.slate, marginTop: 2 }}>Area / Zone: {customer.zones.name}</Text>}
        </View>
        <View style={{ alignItems: "flex-end", justifyContent: "flex-start" }}>
          <Text style={[table.headCell, { backgroundColor: statTone(statusTone), color: "#fff", borderRadius: 4, paddingHorizontal: 8 }]}>
            {STATUS_LABEL[invoice.status] || invoice.status}
          </Text>
        </View>
      </View>

      <View style={table.section}>
        <View style={table.head}>
          <Text style={[table.headCell, { width: "6%" }]}>Sr#</Text>
          <Text style={[table.headCell, { width: "28%" }]}>Product</Text>
          <Text style={[table.headCell, { width: "14%" }]}>Bottle Size</Text>
          <Text style={[table.headCell, { width: "12%", textAlign: "right" }]}>Qty</Text>
          <Text style={[table.headCell, { width: "14%", textAlign: "right" }]}>Rate</Text>
          <Text style={[table.headCell, { width: "12%", textAlign: "right" }]}>Discount</Text>
          <Text style={[table.headCell, { width: "14%", textAlign: "right" }]}>Amount</Text>
        </View>
        {items.length === 0 && <Text style={table.empty}>No line items on this invoice.</Text>}
        {items.map((it, i) => (
          <View key={it.id || i} style={i % 2 ? table.rowAlt : table.row}>
            <Text style={[table.cellMuted, { width: "6%" }]}>{i + 1}</Text>
            <Text style={[table.cell, { width: "28%" }]}>{it.products?.name || it.description}</Text>
            <Text style={[table.cellMuted, { width: "14%" }]}>{it.products?.size_label || "—"}</Text>
            <Text style={[table.cell, { width: "12%", textAlign: "right" }]}>{it.quantity}</Text>
            <Text style={[table.cellMuted, { width: "14%", textAlign: "right" }]}>{pkr(it.rate)}</Text>
            <Text style={[table.cellMuted, { width: "12%", textAlign: "right" }]}>{Number(it.discount) > 0 ? pkr(it.discount) : "—"}</Text>
            <Text style={[table.cellBold, { width: "14%", textAlign: "right" }]}>{pkr(it.amount)}</Text>
          </View>
        ))}
      </View>

      <View style={{ alignItems: "flex-end", marginBottom: 18 }}>
        <View style={{ width: 230 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 }}>
            <Text style={{ fontSize: 8.5, color: COLORS.slate }}>Subtotal</Text>
            <Text style={{ fontSize: 8.5 }}>{pkr(invoice.subtotal ?? invoice.net_amount)}</Text>
          </View>
          {Number(invoice.discount) > 0 && (
            <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 }}>
              <Text style={{ fontSize: 8.5, color: COLORS.slate }}>Discount</Text>
              <Text style={{ fontSize: 8.5, color: statTone("coral") }}>−{pkr(invoice.discount)}</Text>
            </View>
          )}
          <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 3, borderTopWidth: 1, borderTopColor: COLORS.line, marginTop: 2 }}>
            <Text style={{ fontSize: 8.5, color: COLORS.slate }}>Previous balance</Text>
            <Text style={{ fontSize: 8.5 }}>{pkr(previousBalance)}</Text>
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 }}>
            <Text style={{ fontSize: 8.5, color: COLORS.slate }}>Current invoice amount</Text>
            <Text style={{ fontSize: 8.5, fontFamily: "Helvetica-Bold" }}>{pkr(invoice.net_amount)}</Text>
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 }}>
            <Text style={{ fontSize: 8.5, color: COLORS.slate }}>Amount paid</Text>
            <Text style={{ fontSize: 8.5, color: statTone("green") }}>{pkr(paid)}</Text>
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 8, paddingHorizontal: 10, marginTop: 6, backgroundColor: COLORS.navy, borderRadius: 6 }}>
            <Text style={{ fontSize: 9.5, fontFamily: "Helvetica-Bold", color: "#fff" }}>Total Payable</Text>
            <Text style={{ fontSize: 12, fontFamily: "Helvetica-Bold", color: "#fff" }}>{pkr(newBalance)}</Text>
          </View>
        </View>
      </View>

      <View style={{ flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: COLORS.line, paddingTop: 12 }}>
        <View style={{ width: "55%" }}>
          {branding?.bankDetails && (
            <View style={{ marginBottom: 8 }}>
              <Text style={{ fontSize: 7, fontFamily: "Helvetica-Bold", color: COLORS.slate, letterSpacing: 0.4, textTransform: "uppercase" }}>Payment Details</Text>
              <Text style={{ fontSize: 8, color: COLORS.ink, marginTop: 2, lineHeight: 1.4 }}>{branding.bankDetails}</Text>
            </View>
          )}
          {branding?.paymentTerms && (
            <View style={{ marginBottom: 8 }}>
              <Text style={{ fontSize: 7, fontFamily: "Helvetica-Bold", color: COLORS.slate, letterSpacing: 0.4, textTransform: "uppercase" }}>Terms</Text>
              <Text style={{ fontSize: 8, color: COLORS.ink, marginTop: 2 }}>{branding.paymentTerms}</Text>
            </View>
          )}
          {branding?.footerNote && <Text style={{ fontSize: 8, fontFamily: "Helvetica-Oblique", color: COLORS.slate, marginTop: 4 }}>{branding.footerNote}</Text>}
        </View>
        <View style={{ width: "35%", alignItems: "center" }}>
          {branding?.stampImage && <Image src={branding.stampImage} style={{ width: 54, height: 54, marginBottom: 4, opacity: 0.9 }} />}
          {branding?.signatureImage ? (
            <Image src={branding.signatureImage} style={{ width: 90, height: 28, objectFit: "contain" }} />
          ) : (
            <View style={{ width: 120, height: 28 }} />
          )}
          <View style={{ borderTopWidth: 1, borderTopColor: COLORS.ink, width: 120, marginTop: 2 }} />
          <Text style={{ fontSize: 7.5, color: COLORS.slate, marginTop: 3 }}>Authorized Signature</Text>
        </View>
      </View>
    </PdfShell>
  );
}
