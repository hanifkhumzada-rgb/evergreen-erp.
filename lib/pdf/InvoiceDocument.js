import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer";
import { BrandHeader, BrandFooter, DropletMark, brandPageStyle, EMERALD, MINT } from "./DocumentChrome";
import { COLORS } from "./theme";
import { amountInWords } from "./numberToWords";
import { pkr, fmtDate } from "@/lib/format";

const STATUS_LABEL = { paid: "Paid", partially_paid: "Partially Paid", sent: "Payment Due", draft: "Draft", overdue: "Overdue", void: "Void" };

// Evergreen Water sales invoice. The band, header, watermark and footer
// come from the shared DocumentChrome (the same design every PDF uses);
// the body here is invoice-specific: Bill To / From cards, dark-headed item
// table, balance-carry summary with the total payable highlighted, amount
// in words, and a QR code to the customer's portal statement.

const s = StyleSheet.create({
  metaRow: { flexDirection: "row", marginBottom: 14 },
  metaCell: { flex: 1, paddingVertical: 8, paddingHorizontal: 10, backgroundColor: COLORS.foam, borderRadius: 7, marginRight: 8 },
  metaCellLast: { flex: 1, paddingVertical: 8, paddingHorizontal: 10, backgroundColor: COLORS.foam, borderRadius: 7 },
  metaLabel: { fontSize: 6.5, fontFamily: "Helvetica-Bold", color: COLORS.slate, letterSpacing: 0.8, textTransform: "uppercase" },
  metaValue: { fontSize: 9.5, fontFamily: "Helvetica-Bold", color: COLORS.navy, marginTop: 3 },

  partiesRow: { flexDirection: "row", marginBottom: 16 },
  billTo: { flex: 1.35, borderWidth: 1, borderColor: COLORS.line, borderRadius: 9, padding: 12, borderLeftWidth: 4, borderLeftColor: EMERALD, marginRight: 10 },
  from: { flex: 1, borderWidth: 1, borderColor: COLORS.line, borderRadius: 9, padding: 12 },
  partyLabel: { fontSize: 6.8, fontFamily: "Helvetica-Bold", color: EMERALD, letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 },
  partyName: { fontSize: 14, fontFamily: "Helvetica-Bold", color: COLORS.navy },
  partyLine: { fontSize: 8, color: COLORS.ink, marginTop: 2.5, lineHeight: 1.35 },
  partyMuted: { fontSize: 7.6, color: COLORS.slate, marginTop: 2.5 },

  tableWrap: { position: "relative", marginBottom: 14 },
  watermark: { position: "absolute", top: 6, left: 0, right: 0, alignItems: "center" },
  thead: { flexDirection: "row", backgroundColor: COLORS.navy, borderTopLeftRadius: 6, borderTopRightRadius: 6 },
  th: { fontSize: 7.3, fontFamily: "Helvetica-Bold", color: "#FFFFFF", paddingVertical: 8, paddingHorizontal: 7, textTransform: "uppercase", letterSpacing: 0.5 },
  tr: { flexDirection: "row", borderBottomWidth: 0.6, borderBottomColor: COLORS.line },
  td: { fontSize: 8.6, paddingVertical: 8, paddingHorizontal: 7, color: COLORS.ink },
  tdMuted: { fontSize: 8.2, paddingVertical: 8, paddingHorizontal: 7, color: COLORS.slate },
  tdBold: { fontSize: 8.8, paddingVertical: 8, paddingHorizontal: 7, fontFamily: "Helvetica-Bold", color: COLORS.navy },
  empty: { fontSize: 8.5, color: COLORS.slate, padding: 14, textAlign: "center" },

  summaryRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 },
  wordsBox: { width: "50%", paddingTop: 2 },
  wordsLabel: { fontSize: 6.8, fontFamily: "Helvetica-Bold", color: COLORS.slate, letterSpacing: 0.8, textTransform: "uppercase" },
  wordsText: { fontSize: 8.6, fontFamily: "Helvetica-Oblique", color: COLORS.navy, marginTop: 3, lineHeight: 1.4 },
  totals: { width: 236 },
  tRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3.4, paddingHorizontal: 4 },
  tLabel: { fontSize: 8.6, color: COLORS.slate },
  tValue: { fontSize: 8.6, color: COLORS.ink },
  totalBand: { marginTop: 8, borderRadius: 8, height: 44, backgroundColor: COLORS.navy, flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 13 },
  totalLabel: { fontSize: 8.6, fontFamily: "Helvetica-Bold", color: MINT, letterSpacing: 1, textTransform: "uppercase" },
  totalValue: { fontSize: 17, fontFamily: "Helvetica-Bold", color: "#FFFFFF" },

  bottom: { flexDirection: "row", borderTopWidth: 1, borderTopColor: COLORS.line, paddingTop: 12 },
  qrBox: { width: 92, alignItems: "center", marginRight: 14 },
  qr: { width: 78, height: 78 },
  qrCaption: { fontSize: 6.3, color: COLORS.slate, textAlign: "center", marginTop: 3, lineHeight: 1.3 },
  info: { flex: 1, paddingRight: 10 },
  infoLabel: { fontSize: 6.8, fontFamily: "Helvetica-Bold", color: COLORS.slate, letterSpacing: 0.6, textTransform: "uppercase" },
  infoText: { fontSize: 7.8, color: COLORS.ink, marginTop: 2, lineHeight: 1.4, marginBottom: 7 },
  sign: { width: 130, alignItems: "center", justifyContent: "flex-end" },

});

const COLS = [
  { key: "sr", label: "#", width: "6%" },
  { key: "desc", label: "Description", width: "32%" },
  { key: "size", label: "Size", width: "12%" },
  { key: "qty", label: "Qty", width: "10%", align: "right" },
  { key: "rate", label: "Rate", width: "13%", align: "right" },
  { key: "disc", label: "Discount", width: "12%", align: "right" },
  { key: "amt", label: "Amount", width: "15%", align: "right" },
];

export default function InvoiceDocument({ invoice, customer, items, paid, previousBalance, newBalance, branding, qrDataUri, portalUrl }) {
  const statusLabel = STATUS_LABEL[invoice.status] || invoice.status;
  const subtotal = invoice.subtotal ?? invoice.net_amount;
  const discount = Number(invoice.discount) || 0;
  const address = [customer?.building, customer?.address].filter(Boolean).join(", ");

  return (
    <Document title={`Invoice ${invoice.invoice_no}`} author={branding?.businessName || "Evergreen Water"}>
      <Page size="A4" style={brandPageStyle}>
        <BrandHeader
          branding={branding} title="Invoice" subtitle={`# ${invoice.invoice_no}`}
          meta={`${fmtDate(invoice.invoice_date)}${invoice.due_date ? `\nDue: ${fmtDate(invoice.due_date)}` : ""}`}
          status={invoice.status} statusLabel={statusLabel}
        />

        <View style={s.metaRow}>
          <View style={s.metaCell}><Text style={s.metaLabel}>Invoice Date</Text><Text style={s.metaValue}>{fmtDate(invoice.invoice_date)}</Text></View>
          <View style={s.metaCell}><Text style={s.metaLabel}>Due Date</Text><Text style={s.metaValue}>{invoice.due_date ? fmtDate(invoice.due_date) : "On receipt"}</Text></View>
          <View style={s.metaCell}><Text style={s.metaLabel}>Customer ID</Text><Text style={s.metaValue}>{customer?.code || "—"}</Text></View>
          <View style={s.metaCellLast}><Text style={s.metaLabel}>Total Payable</Text><Text style={[s.metaValue, { color: EMERALD }]}>{pkr(newBalance)}</Text></View>
        </View>

        <View style={s.partiesRow}>
          <View style={s.billTo}>
            <Text style={s.partyLabel}>Bill To</Text>
            <Text style={s.partyName}>{customer?.name || "—"}</Text>
            {customer?.business_name && customer.business_name !== customer.name ? <Text style={s.partyMuted}>{customer.business_name}</Text> : null}
            {address ? <Text style={s.partyLine}>{address}</Text> : null}
            {customer?.mobile ? <Text style={s.partyLine}>{customer.mobile}</Text> : null}
            {customer?.zones?.name ? <Text style={s.partyMuted}>Zone: {customer.zones.name}</Text> : null}
          </View>
          <View style={s.from}>
            <Text style={s.partyLabel}>From</Text>
            <Text style={[s.partyName, { fontSize: 11.5 }]}>{branding?.businessName || "Evergreen Water"}</Text>
            {branding?.address ? <Text style={s.partyLine}>{branding.address}</Text> : null}
            {branding?.phone ? <Text style={s.partyLine}>{[branding.phone, branding.phone2].filter(Boolean).join(" / ")}</Text> : null}
            {branding?.ntn ? <Text style={s.partyMuted}>NTN: {branding.ntn}</Text> : null}
          </View>
        </View>

        <View style={s.tableWrap}>
          <View style={s.watermark}><DropletMark /></View>
          <View style={s.thead}>
            {COLS.map((c) => <Text key={c.key} style={[s.th, { width: c.width, textAlign: c.align || "left" }]}>{c.label}</Text>)}
          </View>
          {items.length === 0 && <Text style={s.empty}>No line items on this invoice.</Text>}
          {items.map((it, i) => (
            <View key={it.id || i} style={s.tr} wrap={false}>
              <Text style={[s.tdMuted, { width: COLS[0].width }]}>{String(i + 1).padStart(2, "0")}</Text>
              <Text style={[s.td, { width: COLS[1].width, fontFamily: "Helvetica-Bold" }]}>{it.products?.name || it.description || "Item"}</Text>
              <Text style={[s.tdMuted, { width: COLS[2].width }]}>{it.products?.size_label || "—"}</Text>
              <Text style={[s.td, { width: COLS[3].width, textAlign: "right" }]}>{it.quantity}</Text>
              <Text style={[s.tdMuted, { width: COLS[4].width, textAlign: "right" }]}>{pkr(it.rate)}</Text>
              <Text style={[s.tdMuted, { width: COLS[5].width, textAlign: "right" }]}>{Number(it.discount) > 0 ? pkr(it.discount) : "—"}</Text>
              <Text style={[s.tdBold, { width: COLS[6].width, textAlign: "right" }]}>{pkr(it.amount)}</Text>
            </View>
          ))}
        </View>

        <View style={s.summaryRow} wrap={false}>
          <View style={s.wordsBox}>
            <Text style={s.wordsLabel}>Amount in words</Text>
            <Text style={s.wordsText}>{amountInWords(Math.max(0, Number(newBalance) || 0), branding?.currency || "PKR")}</Text>
            {branding?.bankDetails ? (
              <View style={{ marginTop: 10 }}>
                <Text style={s.wordsLabel}>Payment details</Text>
                <Text style={[s.infoText, { marginBottom: 0 }]}>{branding.bankDetails}</Text>
              </View>
            ) : null}
          </View>
          <View style={s.totals}>
            <View style={s.tRow}><Text style={s.tLabel}>Subtotal</Text><Text style={s.tValue}>{pkr(subtotal)}</Text></View>
            {discount > 0 ? <View style={s.tRow}><Text style={s.tLabel}>Discount</Text><Text style={[s.tValue, { color: COLORS.coral }]}>- {pkr(discount)}</Text></View> : null}
            <View style={[s.tRow, { borderTopWidth: 0.8, borderTopColor: COLORS.line, marginTop: 2, paddingTop: 5 }]}><Text style={s.tLabel}>This invoice</Text><Text style={[s.tValue, { fontFamily: "Helvetica-Bold" }]}>{pkr(invoice.net_amount)}</Text></View>
            <View style={s.tRow}><Text style={s.tLabel}>Previous balance</Text><Text style={s.tValue}>{pkr(previousBalance)}</Text></View>
            <View style={s.tRow}><Text style={s.tLabel}>Amount paid</Text><Text style={[s.tValue, { color: COLORS.green }]}>{Number(paid) > 0 ? `- ${pkr(paid)}` : pkr(0)}</Text></View>
            <View style={s.totalBand}>
              <Text style={s.totalLabel}>Total Outstanding</Text>
              <Text style={s.totalValue}>{pkr(newBalance)}</Text>
            </View>
          </View>
        </View>

        <View style={s.bottom} wrap={false}>
          {qrDataUri ? (
            <View style={s.qrBox}>
              <Image src={qrDataUri} style={s.qr} />
              <Text style={s.qrCaption}>Scan to view your statement and payment status online</Text>
            </View>
          ) : null}
          <View style={s.info}>
            {branding?.paymentTerms ? <><Text style={s.infoLabel}>Terms</Text><Text style={s.infoText}>{branding.paymentTerms}</Text></> : null}
            {portalUrl ? <><Text style={s.infoLabel}>Customer portal</Text><Text style={s.infoText}>{portalUrl}</Text></> : null}
            {branding?.footerNote ? <Text style={[s.infoText, { fontFamily: "Helvetica-Oblique", color: COLORS.slate }]}>{branding.footerNote}</Text> : null}
          </View>
          <View style={s.sign}>
            {branding?.stampImage ? <Image src={branding.stampImage} style={{ width: 52, height: 52, marginBottom: 4, opacity: 0.9 }} /> : null}
            {branding?.signatureImage ? <Image src={branding.signatureImage} style={{ width: 92, height: 28, objectFit: "contain" }} /> : <View style={{ height: 28 }} />}
            <View style={{ borderTopWidth: 1, borderTopColor: COLORS.ink, width: 120, marginTop: 2 }} />
            <Text style={{ fontSize: 7.2, color: COLORS.slate, marginTop: 3 }}>Authorized Signature</Text>
          </View>
        </View>

        <BrandFooter left={`Thank you for choosing ${branding?.businessName || "Evergreen Water"}`} rightPrefix={invoice.invoice_no} />
      </Page>
    </Document>
  );
}
