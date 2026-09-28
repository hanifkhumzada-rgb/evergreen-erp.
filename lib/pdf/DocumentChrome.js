import { Document, Page, View, Text, Image, Svg, Defs, LinearGradient, Stop, Rect, Path, StyleSheet, Font } from "@react-pdf/renderer";
import { COLORS } from "./theme";

// Evergreen Water document design language, shared by EVERY generated PDF
// (invoice, statement, receipts, vouchers, reports): a full-bleed
// teal→emerald gradient band with a water-wave edge, the logo on a white
// tile + company identity on the left, the document type (and number/
// period) large on the right, a faint EW droplet watermark, and a dark
// brand footer bar with page numbers. Customer-facing documents can add a
// QR code to the relevant Customer Portal page. All identity comes from
// `branding` (getBusinessBranding → Settings → Business Branding).
// Never split a word with a hyphen (react-pdf's default breaks long titles
// like "STATEMENT" mid-word); wrap only between words.
Font.registerHyphenationCallback((word) => [word]);

export const BAND_H = 132;
export const PAD = 36;
export const MINT = "#9EF0D0";
export const EMERALD = "#087C69";
const FOOTER_H = 34;

const styles = StyleSheet.create({
  page: { paddingTop: BAND_H + 18, paddingBottom: FOOTER_H + 26, paddingHorizontal: PAD, fontSize: 9, fontFamily: "Helvetica", color: COLORS.ink },
  band: { position: "absolute", top: 0, left: 0, right: 0, height: BAND_H },
  bandContent: { position: "absolute", top: 26, left: PAD, right: PAD, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  logoTile: { width: 58, height: 58, borderRadius: 14, backgroundColor: "#FFFFFF", padding: 5, marginRight: 12 },
  logo: { width: 48, height: 48, borderRadius: 10, objectFit: "contain" },
  brandName: { fontSize: 19, fontFamily: "Helvetica-Bold", color: "#FFFFFF", letterSpacing: 0.4 },
  brandTagline: { fontSize: 7.2, fontFamily: "Helvetica-Bold", color: MINT, letterSpacing: 1.4, textTransform: "uppercase", marginTop: 3 },
  brandContact: { fontSize: 7, color: "#D7EFEC", marginTop: 6, lineHeight: 1.45, maxWidth: 290 },
  right: { width: 230, alignItems: "flex-end" },
  docTitle: { fontFamily: "Helvetica-Bold", color: "#FFFFFF", textAlign: "right", textTransform: "uppercase" },
  docSubtitle: { fontSize: 10.5, fontFamily: "Helvetica-Bold", color: MINT, textAlign: "right", marginTop: 2, letterSpacing: 0.6 },
  docMeta: { fontSize: 7.4, color: "#D7EFEC", textAlign: "right", marginTop: 4, lineHeight: 1.45 },
  watermark: { position: "absolute", top: 300, left: 0, right: 0, alignItems: "center" },
  qrRow: { flexDirection: "row", alignItems: "center", marginTop: 14, paddingTop: 10, borderTopWidth: 1, borderTopColor: COLORS.line },
  qr: { width: 70, height: 70, marginRight: 12 },
  qrTitle: { fontSize: 7, fontFamily: "Helvetica-Bold", color: EMERALD, letterSpacing: 0.8, textTransform: "uppercase" },
  qrText: { fontSize: 7.6, color: COLORS.slate, marginTop: 3, lineHeight: 1.4 },
  footer: { position: "absolute", bottom: 0, left: 0, right: 0, height: FOOTER_H, backgroundColor: COLORS.navy, paddingHorizontal: PAD, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  footerLeft: { fontSize: 7.2, fontFamily: "Helvetica-Bold", color: MINT },
  footerRight: { fontSize: 6.8, color: "#D7EFEC" },
});

// Address on one line, phones/email on the next, so nothing (e.g. an email
// address) gets hyphen-wrapped mid-word inside the band.
export function contactLines(branding) {
  const phones = [branding?.phone, branding?.phone2].filter(Boolean).join(" / ");
  return [branding?.address, [phones, branding?.email].filter(Boolean).join("  ·  ")].filter(Boolean);
}

// Long titles ("Outstanding / Receivables Report") step down in size so
// they stay on one or two lines in the band's right column.
function titleSize(title) {
  const len = String(title || "").length;
  if (len <= 8) return { fontSize: 30, letterSpacing: 4 };
  if (len <= 12) return { fontSize: 22, letterSpacing: 2 };
  if (len <= 20) return { fontSize: 16, letterSpacing: 1.2 };
  return { fontSize: 14, letterSpacing: 0.8 };
}

// Full-bleed gradient band with a soft water-wave lower edge (every page).
export function BrandBand() {
  return (
    <Svg style={styles.band} viewBox={`0 0 595 ${BAND_H}`} fixed>
      <Defs>
        <LinearGradient id="ewBand" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#063D3B" />
          <Stop offset="0.6" stopColor="#07564D" />
          <Stop offset="1" stopColor={EMERALD} />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="595" height={BAND_H} fill="url(#ewBand)" />
      <Path d={`M0 ${BAND_H - 18} C 120 ${BAND_H - 34}, 220 ${BAND_H + 4}, 340 ${BAND_H - 12} S 520 ${BAND_H - 30}, 595 ${BAND_H - 16} L 595 ${BAND_H} L 0 ${BAND_H} Z`} fill="#FFFFFF" fillOpacity="0.10" />
      <Path d={`M0 ${BAND_H - 6} C 150 ${BAND_H - 20}, 260 ${BAND_H + 6}, 400 ${BAND_H - 6} S 540 ${BAND_H - 14}, 595 ${BAND_H - 4} L 595 ${BAND_H} L 0 ${BAND_H} Z`} fill="#FFFFFF" />
    </Svg>
  );
}

// Logo tile + identity (left) and document title/number/meta (right),
// printed on top of the band on every page. `extra` renders under the meta
// (e.g. the invoice's status pill).
export function BrandHeader({ branding, title, subtitle, meta, extra }) {
  const contact = contactLines(branding);
  return (
    <View style={styles.bandContent} fixed>
      <View style={{ flexDirection: "row", alignItems: "flex-start", flex: 1, paddingRight: 12 }}>
        {branding?.logo ? <View style={styles.logoTile}><Image src={branding.logo} style={styles.logo} /></View> : null}
        <View style={{ flex: 1 }}>
          <Text style={styles.brandName}>{branding?.businessName || "Evergreen Water"}</Text>
          {branding?.tagline ? <Text style={styles.brandTagline}>{branding.tagline}</Text> : null}
          {contact.length ? <Text style={styles.brandContact}>{contact.join("\n")}</Text> : null}
        </View>
      </View>
      <View style={styles.right}>
        <Text style={[styles.docTitle, titleSize(title)]}>{title}</Text>
        {subtitle ? <Text style={styles.docSubtitle}>{subtitle}</Text> : null}
        {meta ? <Text style={styles.docMeta}>{meta}</Text> : null}
        {extra || null}
      </View>
    </View>
  );
}

// Faint EW water-droplet mark. Standalone so a document can place it (the
// invoice puts it behind its item table); PdfShell centres it on the page.
export function DropletMark({ width = 150, height = 180 }) {
  return (
    <Svg width={width} height={height} viewBox="0 0 100 120">
      <Path d="M50 4 C 50 4, 12 50, 12 76 A 38 38 0 0 0 88 76 C 88 50, 50 4, 50 4 Z" fill={COLORS.navy} fillOpacity="0.045" />
      <Path d="M30 86 C 40 94, 60 94, 70 86" stroke={COLORS.navy} strokeOpacity="0.07" strokeWidth="3" fill="none" />
    </Svg>
  );
}

// Dark brand footer bar with page numbers (every page).
export function BrandFooter({ left, rightPrefix = "" }) {
  return (
    <View style={styles.footer} fixed>
      <Text style={styles.footerLeft}>{left}</Text>
      <Text style={styles.footerRight} render={({ pageNumber, totalPages }) => `${rightPrefix ? `${rightPrefix}  ·  ` : ""}Page ${pageNumber} of ${totalPages}  ·  Computer-generated document`} />
    </View>
  );
}

// QR to a Customer Portal page, for customer-facing documents only.
export function QrBlock({ qrDataUri, title = "View online", text, url }) {
  if (!qrDataUri) return null;
  return (
    <View style={styles.qrRow} wrap={false}>
      <Image src={qrDataUri} style={styles.qr} />
      <View style={{ flex: 1 }}>
        <Text style={styles.qrTitle}>{title}</Text>
        {text ? <Text style={styles.qrText}>{text}</Text> : null}
        {url ? <Text style={[styles.qrText, { color: COLORS.ink }]}>{url}</Text> : null}
      </View>
    </View>
  );
}

export const brandPageStyle = styles.page;

// Shared branded A4 page used by every PDF document except the invoice
// (which builds its own body but uses the same band/header/footer). Each
// document keeps its own content; this supplies the whole look.
// Props: title (document type), meta (multi-line string: number/date/
// period), subtitle (optional prominent number), branding, and optional
// qr = { dataUri, title, text, url } for customer-facing documents.
export function PdfShell({ title, meta, subtitle, branding, children, qr }) {
  const generated = new Date().toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  return (
    <Document title={title} author={branding?.businessName || "Evergreen Water"}>
      <Page size="A4" style={styles.page}>
        <BrandBand />
        <BrandHeader branding={branding} title={title} subtitle={subtitle} meta={meta} />
        <View style={styles.watermark} fixed><DropletMark width={190} height={228} /></View>

        {children}

        {qr?.dataUri ? <QrBlock qrDataUri={qr.dataUri} title={qr.title} text={qr.text} url={qr.url} /> : null}

        <BrandFooter left={`${branding?.businessName || "Evergreen Water"}  ·  Generated ${generated}`} />
      </Page>
    </Document>
  );
}
