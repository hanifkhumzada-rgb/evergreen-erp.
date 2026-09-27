import { Document, Page, View, Text, Image, Svg, Defs, LinearGradient, Stop, Rect, Path, StyleSheet } from "@react-pdf/renderer";
import { COLORS } from "./theme";
import { amountInWords } from "./numberToWords";
import { pkr, fmtDate } from "@/lib/format";

const STATUS_LABEL = { paid: "Paid", partially_paid: "Partially Paid", sent: "Payment Due", draft: "Draft", overdue: "Overdue", void: "Void" };
const STATUS_BG = { paid: "#16A34A", partially_paid: "#D97706", sent: "#F59E0B", draft: "#5C7D78", overdue: "#DC2626", void: "#DC2626" };

// Evergreen Water sales invoice (invoice-only layout; every other document
// keeps the shared PdfShell letterhead). Bold brand band, clear Bill To
// card, dark-headed item table and a balance-carry summary with the total
// payable highlighted. Evergreen-specific touches: a teal→emerald gradient
// band with a water-wave edge, a faint EW droplet watermark behind the
// items, the amount in words, and a QR code to the customer's portal
// statement. All identity comes from `branding` (Settings → Business Branding).
const BAND_H = 132;
const PAD = 36;
const MINT = "#9EF0D0";
const EMERALD = "#087C69";

const s = StyleSheet.create({
  page: { paddingTop: BAND_H + 18, paddingBottom: 64, paddingHorizontal: PAD, fontSize: 9, fontFamily: "Helvetica", color: COLORS.ink },
  band: { position: "absolute", top: 0, left: 0, right: 0, height: BAND_H },
  bandContent: { position: "absolute", top: 26, left: PAD, right: PAD, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  logoTile: { width: 58, height: 58, borderRadius: 14, backgroundColor: "#FFFFFF", padding: 5, marginRight: 12 },
  logo: { width: 48, height: 48, borderRadius: 10, objectFit: "contain" },
  brandName: { fontSize: 19, fontFamily: "Helvetica-Bold", color: "#FFFFFF", letterSpacing: 0.4 },
  brandTagline: { fontSize: 7.2, fontFamily: "Helvetica-Bold", color: MINT, letterSpacing: 1.4, textTransform: "uppercase", marginTop: 3 },
  brandContact: { fontSize: 7, color: "#D7EFEC", marginTop: 6, lineHeight: 1.45, maxWidth: 300 },
  invWord: { fontSize: 30, fontFamily: "Helvetica-Bold", color: "#FFFFFF", letterSpacing: 4, textAlign: "right" },
  invNo: { fontSize: 10.5, fontFamily: "Helvetica-Bold", color: MINT, textAlign: "right", marginTop: 2, letterSpacing: 0.6 },
  statusPill: { alignSelf: "flex-end", marginTop: 8, paddingVertical: 3, paddingHorizontal: 9, borderRadius: 10, fontSize: 7.2, fontFamily: "Helvetica-Bold", color: "#FFFFFF", textTransform: "uppercase", letterSpacing: 0.8 },

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
  totalBand: { marginTop: 8, borderRadius: 8, overflow: "hidden", height: 44 },
  totalInner: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 13 },
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

  footer: { position: "absolute", bottom: 0, left: 0, right: 0, height: 34, backgroundColor: COLORS.navy, paddingHorizontal: PAD, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  footerText: { fontSize: 6.8, color: "#D7EFEC" },
  footerThanks: { fontSize: 7.4, fontFamily: "Helvetica-Bold", color: MINT },
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

// Address on one line, phones/email on the next, so nothing (e.g. an email
// address) gets hyphen-wrapped mid-word in the band.
function contactLines(branding) {
  const phones = [branding?.phone, branding?.phone2].filter(Boolean).join(" / ");
  return [branding?.address, [phones, branding?.email].filter(Boolean).join("  ·  ")].filter(Boolean);
}

// Brand band: teal→emerald gradient with a soft water-wave lower edge.
function Band() {
  return (
    <Svg style={s.band} viewBox={`0 0 595 ${BAND_H}`} fixed>
      <Defs>
        <LinearGradient id="band" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#063D3B" />
          <Stop offset="0.6" stopColor="#07564D" />
          <Stop offset="1" stopColor={EMERALD} />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="595" height={BAND_H} fill="url(#band)" />
      <Path d={`M0 ${BAND_H - 18} C 120 ${BAND_H - 34}, 220 ${BAND_H + 4}, 340 ${BAND_H - 12} S 520 ${BAND_H - 30}, 595 ${BAND_H - 16} L 595 ${BAND_H} L 0 ${BAND_H} Z`} fill="#FFFFFF" fillOpacity="0.10" />
      <Path d={`M0 ${BAND_H - 6} C 150 ${BAND_H - 20}, 260 ${BAND_H + 6}, 400 ${BAND_H - 6} S 540 ${BAND_H - 14}, 595 ${BAND_H - 4} L 595 ${BAND_H} L 0 ${BAND_H} Z`} fill="#FFFFFF" />
    </Svg>
  );
}

// Faint EW water-droplet mark behind the item table.
function Watermark() {
  return (
    <View style={s.watermark}>
      <Svg width="150" height="180" viewBox="0 0 100 120">
        <Path d="M50 4 C 50 4, 12 50, 12 76 A 38 38 0 0 0 88 76 C 88 50, 50 4, 50 4 Z" fill={COLORS.navy} fillOpacity="0.045" />
        <Path d="M30 86 C 40 94, 60 94, 70 86" stroke={COLORS.navy} strokeOpacity="0.07" strokeWidth="3" fill="none" />
      </Svg>
    </View>
  );
}

export default function InvoiceDocument({ invoice, customer, items, paid, previousBalance, newBalance, branding, qrDataUri, portalUrl }) {
  const statusLabel = STATUS_LABEL[invoice.status] || invoice.status;
  const contact = contactLines(branding);
  const subtotal = invoice.subtotal ?? invoice.net_amount;
  const discount = Number(invoice.discount) || 0;
  const address = [customer?.building, customer?.address].filter(Boolean).join(", ");

  return (
    <Document title={`Invoice ${invoice.invoice_no}`} author={branding?.businessName || "Evergreen Water"}>
      <Page size="A4" style={s.page}>
        <Band />
        <View style={s.bandContent} fixed>
          <View style={{ flexDirection: "row", alignItems: "flex-start", flex: 1 }}>
            {branding?.logo ? <View style={s.logoTile}><Image src={branding.logo} style={s.logo} /></View> : null}
            <View style={{ flex: 1 }}>
              <Text style={s.brandName}>{branding?.businessName || "Evergreen Water"}</Text>
              {branding?.tagline ? <Text style={s.brandTagline}>{branding.tagline}</Text> : null}
              {contact.length ? <Text style={s.brandContact}>{contact.join("\n")}</Text> : null}
            </View>
          </View>
          <View style={{ width: 190 }}>
            <Text style={s.invWord}>INVOICE</Text>
            <Text style={s.invNo}># {invoice.invoice_no}</Text>
            <Text style={[s.statusPill, { backgroundColor: STATUS_BG[invoice.status] || COLORS.slate }]}>{statusLabel}</Text>
          </View>
        </View>

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
          <Watermark />
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
              <Svg style={{ position: "absolute", top: 0, left: 0, width: 236, height: 44 }} viewBox="0 0 236 44">
                <Defs>
                  <LinearGradient id="tot" x1="0" y1="0" x2="1" y2="0">
                    <Stop offset="0" stopColor={COLORS.navy} />
                    <Stop offset="1" stopColor={EMERALD} />
                  </LinearGradient>
                </Defs>
                <Rect x="0" y="0" width="236" height="44" rx="8" ry="8" fill="url(#tot)" />
              </Svg>
              <View style={s.totalInner}>
                <Text style={s.totalLabel}>Total Payable</Text>
                <Text style={s.totalValue}>{pkr(newBalance)}</Text>
              </View>
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

        <View style={s.footer} fixed>
          <Text style={s.footerThanks}>Thank you for choosing {branding?.businessName || "Evergreen Water"}</Text>
          <Text style={s.footerText} render={({ pageNumber, totalPages }) => `${invoice.invoice_no}  ·  Page ${pageNumber} of ${totalPages}  ·  Computer-generated invoice`} />
        </View>
      </Page>
    </Document>
  );
}
