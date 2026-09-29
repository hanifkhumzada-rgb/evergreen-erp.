import { Document, Page, View, Text, Image, Svg, Path, StyleSheet, Font } from "@react-pdf/renderer";
import { COLORS } from "./theme";

Font.registerHyphenationCallback((word) => [word]);
export const PAD = 34;
export const EMERALD = COLORS.aqua;
export const MINT = "#DDF8F1";

const styles = StyleSheet.create({
  page: { paddingTop: 116, paddingBottom: 48, paddingHorizontal: PAD, fontSize: 9, fontFamily: "Helvetica", color: COLORS.ink, backgroundColor: "#FFFFFF" },
  header: { position: "absolute", top: 0, left: PAD, right: PAD, height: 98, paddingTop: 24, paddingBottom: 13, borderBottomWidth: 2, borderBottomColor: COLORS.aqua, flexDirection: "row", justifyContent: "space-between" },
  brand: { flexDirection: "row", alignItems: "flex-start", flex: 1, paddingRight: 18 },
  logoTile: { width: 48, height: 48, borderRadius: 10, backgroundColor: COLORS.navy, padding: 3, marginRight: 10 },
  logo: { width: 42, height: 42, borderRadius: 8, objectFit: "contain" },
  brandName: { fontSize: 16, fontFamily: "Helvetica-Bold", color: COLORS.navy, letterSpacing: 0.25 },
  brandTagline: { fontSize: 7, fontFamily: "Helvetica-Bold", color: COLORS.aqua, letterSpacing: 0.6, marginTop: 2 },
  brandContact: { fontSize: 6.8, color: COLORS.slate, marginTop: 5, lineHeight: 1.35, maxWidth: 290 },
  headerRight: { width: 220, alignItems: "flex-end" },
  docTitle: { fontSize: 19, fontFamily: "Helvetica-Bold", color: COLORS.navy, textAlign: "right", textTransform: "uppercase", letterSpacing: 0.9 },
  docSubtitle: { fontSize: 9, fontFamily: "Helvetica-Bold", color: COLORS.aqua, textAlign: "right", marginTop: 3 },
  docMeta: { fontSize: 7.2, color: COLORS.slate, textAlign: "right", marginTop: 4, lineHeight: 1.35 },
  footer: { position: "absolute", bottom: 0, left: 0, right: 0, height: 32, paddingHorizontal: PAD, borderTopWidth: 1, borderTopColor: COLORS.line, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  footerLeft: { fontSize: 6.8, fontFamily: "Helvetica-Bold", color: COLORS.navy },
  footerRight: { fontSize: 6.5, color: COLORS.slate },
  status: { paddingVertical: 3, paddingHorizontal: 8, borderRadius: 9, marginTop: 6, fontSize: 6.8, fontFamily: "Helvetica-Bold", textTransform: "uppercase", letterSpacing: 0.45 },
  infoCard: { borderWidth: 1, borderColor: COLORS.line, borderRadius: 8, padding: 11, marginBottom: 13 },
  infoTitle: { fontSize: 6.8, fontFamily: "Helvetica-Bold", color: COLORS.aqua, textTransform: "uppercase", letterSpacing: 0.75, marginBottom: 7 },
  infoGrid: { flexDirection: "row", flexWrap: "wrap" },
  infoItem: { width: "50%", paddingRight: 10, marginBottom: 6 },
  infoLabel: { fontSize: 6.3, fontFamily: "Helvetica-Bold", color: COLORS.slate, textTransform: "uppercase", letterSpacing: 0.45 },
  infoValue: { fontSize: 8.8, color: COLORS.ink, marginTop: 2 },
  summary: { borderWidth: 1, borderColor: COLORS.line, borderRadius: 8, overflow: "hidden" },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4.5, paddingHorizontal: 9, borderBottomWidth: 0.6, borderBottomColor: COLORS.line },
  summaryLabel: { fontSize: 8, color: COLORS.slate },
  summaryValue: { fontSize: 8.2, fontFamily: "Helvetica-Bold", color: COLORS.ink },
  summaryTotal: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 9, paddingHorizontal: 10, backgroundColor: COLORS.navy },
  summaryTotalLabel: { fontSize: 8, fontFamily: "Helvetica-Bold", color: MINT, textTransform: "uppercase", letterSpacing: 0.7 },
  summaryTotalValue: { fontSize: 14, fontFamily: "Helvetica-Bold", color: "#FFFFFF" },
  qrRow: { flexDirection: "row", alignItems: "center", marginTop: 13, paddingTop: 10, borderTopWidth: 1, borderTopColor: COLORS.line },
  qr: { width: 64, height: 64, marginRight: 11 },
  qrTitle: { fontSize: 7, fontFamily: "Helvetica-Bold", color: COLORS.aqua, letterSpacing: 0.7, textTransform: "uppercase" },
  qrText: { fontSize: 7.3, color: COLORS.slate, marginTop: 3, lineHeight: 1.35 },
});

const STATUS_TONES = {
  approved: ["#E7F8EF", "#137A4C"], paid: ["#E7F8EF", "#137A4C"], payment_received: ["#E7F8EF", "#137A4C"],
  partial: ["#FFF4D6", "#9A6700"], partially_paid: ["#FFF4D6", "#9A6700"], pending: ["#FFF4D6", "#9A6700"], pending_approval: ["#FFF4D6", "#9A6700"], sent: ["#FFF4D6", "#9A6700"],
  rejected: ["#FDEBEC", "#B42318"], reversed: ["#FDEBEC", "#B42318"], cancelled: ["#FDEBEC", "#B42318"], failed: ["#FDEBEC", "#B42318"], overdue: ["#FDEBEC", "#B42318"], void: ["#FDEBEC", "#B42318"],
  draft: ["#EEF2F3", "#526A67"], unpaid: ["#EEF2F3", "#526A67"],
};

export function contactLines(branding) { const phones = [branding?.phone, branding?.phone2].filter(Boolean).join(" / "); return [branding?.address, [phones, branding?.email].filter(Boolean).join("  ·  ")].filter(Boolean); }
export function BrandBand() { return null; }

export function DocumentStatusBadge({ status, label }) {
  const normalized = String(status || "draft").toLowerCase().replaceAll(" ", "_");
  const [backgroundColor, color] = STATUS_TONES[normalized] || STATUS_TONES.draft;
  return <Text style={[styles.status, { backgroundColor, color }]}>{label || String(status || "Draft").replaceAll("_", " ")}</Text>;
}

export function BrandHeader({ branding, title, subtitle, meta, extra, status, statusLabel }) {
  const contact = contactLines(branding);
  return <View style={styles.header} fixed><View style={styles.brand}>{branding?.logo ? <View style={styles.logoTile}><Image src={branding.logo} style={styles.logo} /></View> : null}<View style={{ flex: 1 }}><Text style={styles.brandName}>{branding?.businessName || "Evergreen Water"}</Text><Text style={styles.brandTagline}>PURE DRINKING WATER · 19L DOORSTEP DELIVERY</Text>{contact.length ? <Text style={styles.brandContact}>{contact.join("\n")}</Text> : null}</View></View><View style={styles.headerRight}><Text style={styles.docTitle}>{title}</Text>{subtitle ? <Text style={styles.docSubtitle}>{subtitle}</Text> : null}{meta ? <Text style={styles.docMeta}>{meta}</Text> : null}{status ? <DocumentStatusBadge status={status} label={statusLabel} /> : extra || null}</View></View>;
}

export function CustomerInfo({ title = "Customer Information", items = [] }) {
  const visible = items.filter((item) => item?.value !== null && item?.value !== undefined && item?.value !== "");
  if (!visible.length) return null;
  return <View style={styles.infoCard} wrap={false}><Text style={styles.infoTitle}>{title}</Text><View style={styles.infoGrid}>{visible.map(({ label, value }) => <View key={label} style={styles.infoItem}><Text style={styles.infoLabel}>{label}</Text><Text style={styles.infoValue}>{value}</Text></View>)}</View></View>;
}

export function AmountSummary({ rows = [], totalLabel = "Total Outstanding", totalValue }) {
  return <View style={styles.summary} wrap={false}>{rows.filter((row) => row?.value !== null && row?.value !== undefined).map(({ label, value }) => <View key={label} style={styles.summaryRow}><Text style={styles.summaryLabel}>{label}</Text><Text style={styles.summaryValue}>{value}</Text></View>)}<View style={styles.summaryTotal}><Text style={styles.summaryTotalLabel}>{totalLabel}</Text><Text style={styles.summaryTotalValue}>{totalValue}</Text></View></View>;
}

export function BottleSummary({ delivered, returned, damaged, balance }) { return <CustomerInfo title="Bottle Summary" items={[{ label: "Delivered", value: delivered }, { label: "Empty Returned", value: returned }, { label: "Damaged / Lost", value: damaged }, { label: "Bottles in Hand", value: balance }]} />; }
export function DropletMark({ width = 150, height = 180 }) { return <Svg width={width} height={height} viewBox="0 0 100 120"><Path d="M50 4 C50 4 12 50 12 76 A38 38 0 0 0 88 76 C88 50 50 4 50 4Z" fill={COLORS.aqua} fillOpacity="0.035" /></Svg>; }
export function BrandFooter({ left, rightPrefix = "" }) { return <View style={styles.footer} fixed><Text style={styles.footerLeft}>{left}</Text><Text style={styles.footerRight} render={({ pageNumber, totalPages }) => `${rightPrefix ? `${rightPrefix}  ·  ` : ""}Page ${pageNumber} of ${totalPages}  ·  Computer-generated`} /></View>; }
export function QrBlock({ qrDataUri, title = "View online", text, url }) { if (!qrDataUri) return null; return <View style={styles.qrRow} wrap={false}><Image src={qrDataUri} style={styles.qr} /><View style={{ flex: 1 }}><Text style={styles.qrTitle}>{title}</Text>{text ? <Text style={styles.qrText}>{text}</Text> : null}{url ? <Text style={[styles.qrText, { color: COLORS.ink }]}>{url}</Text> : null}</View></View>; }

export const brandPageStyle = styles.page;
export function PdfShell({ title, meta, subtitle, branding, children, qr, status, statusLabel, orientation = "portrait" }) {
  const generated = new Date().toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  return <Document title={title} author={branding?.businessName || "Evergreen Water"}><Page size="A4" orientation={orientation} style={styles.page}><BrandHeader branding={branding} title={title} subtitle={subtitle} meta={meta} status={status} statusLabel={statusLabel} />{children}{qr?.dataUri ? <QrBlock qrDataUri={qr.dataUri} title={qr.title} text={qr.text} url={qr.url} /> : null}<BrandFooter left={`${branding?.businessName || "Evergreen Water"} · Generated ${generated}`} /></Page></Document>;
}
