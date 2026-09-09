import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer";
import { COLORS, PAGE_PADDING } from "./theme";

const styles = StyleSheet.create({
  page: { padding: PAGE_PADDING, paddingBottom: 46, fontSize: 9, fontFamily: "Helvetica", color: COLORS.ink },

  // Universal document header — logo left, company identity centered,
  // document type/number/date right. Every generated document (invoice,
  // receipt, statement, voucher, report) shares this exact layout so the
  // whole set reads as one premium, consistent identity rather than
  // per-document one-off styling.
  headerRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16, paddingBottom: 14, borderBottomWidth: 2, borderBottomColor: COLORS.navy },
  headerLeft: { width: 64 },
  // Logo + company name are the primary brand element on every document —
  // sized up noticeably from tagline/contact/meta text so they read as the
  // letterhead's focal point at a glance, not just another header field.
  logo: { width: 58, height: 58, borderRadius: 10 },
  headerCenter: { flex: 1, alignItems: "center", paddingHorizontal: 10 },
  brandName: { fontSize: 22, fontFamily: "Helvetica-Bold", color: COLORS.navy, letterSpacing: 0.6, textAlign: "center" },
  brandTagline: { fontSize: 7.5, fontFamily: "Helvetica-Bold", color: COLORS.aqua, marginTop: 2, letterSpacing: 0.8, textTransform: "uppercase", textAlign: "center" },
  brandContact: { fontSize: 6.8, color: COLORS.slate, marginTop: 5, textAlign: "center", lineHeight: 1.5 },
  headerRight: { width: 160, alignItems: "flex-end" },
  docTitle: { fontSize: 12, fontFamily: "Helvetica-Bold", color: COLORS.navy, letterSpacing: 0.4, textTransform: "uppercase", textAlign: "right" },
  docMeta: { fontSize: 7.5, color: COLORS.slate, marginTop: 4, textAlign: "right", lineHeight: 1.5 },

  footer: { position: "absolute", bottom: 20, left: PAGE_PADDING, right: PAGE_PADDING, borderTopWidth: 1, borderTopColor: COLORS.line, paddingTop: 6 },
  footerRow: { flexDirection: "row", justifyContent: "space-between" },
  footerText: { fontSize: 6.8, color: COLORS.slate },
  footerNote: { fontSize: 6.5, color: COLORS.slate, textAlign: "center", marginTop: 3, fontFamily: "Helvetica-Oblique" },
});

// Compact "Address · Phone · Email" contact line under the brand mark —
// only the pieces the Owner has actually filled in on Settings.
function contactLine(branding) {
  const phones = [branding?.phone, branding?.phone2].filter(Boolean).join(" / ");
  return [branding?.address, phones, branding?.email].filter(Boolean).join("   ·   ");
}

// Shared branded A4 page shell used by every PDF document (invoice,
// receipt, statement, vouchers, reports) so they read as one consistent,
// premium set. `branding` is the object getBusinessBranding() returns —
// changing anything on the Settings page's Business Branding card updates
// every one of these documents the next time they're generated.
export function PdfShell({ title, meta, branding, children }) {
  const generated = new Date().toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  const contact = contactLine(branding);
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            {branding?.logo && <Image src={branding.logo} style={styles.logo} />}
          </View>
          <View style={styles.headerCenter}>
            <Text style={styles.brandName}>{branding?.businessName || "Evergreen Water"}</Text>
            {branding?.tagline && <Text style={styles.brandTagline}>{branding.tagline}</Text>}
            {contact ? <Text style={styles.brandContact}>{contact}</Text> : null}
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.docTitle}>{title}</Text>
            {meta ? <Text style={styles.docMeta}>{meta}</Text> : null}
          </View>
        </View>

        {children}

        <View style={styles.footer} fixed>
          <View style={styles.footerRow}>
            <Text style={styles.footerText}>{`Generated ${generated}`}</Text>
            <Text style={styles.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
          </View>
          <Text style={styles.footerNote}>This is a computer-generated document and does not require a signature unless noted.</Text>
        </View>
      </Page>
    </Document>
  );
}
