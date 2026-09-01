import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer";
import { COLORS, PAGE_PADDING } from "./theme";
import { getLogoDataUri } from "./logo";

const styles = StyleSheet.create({
  page: { padding: PAGE_PADDING, paddingBottom: 50, fontSize: 9, fontFamily: "Helvetica", color: COLORS.ink },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16, paddingBottom: 12, borderBottomWidth: 2, borderBottomColor: COLORS.navy },
  brandRow: { flexDirection: "row", alignItems: "center" },
  logo: { width: 32, height: 32, borderRadius: 6, marginRight: 8 },
  brandName: { fontSize: 13, fontFamily: "Helvetica-Bold", color: COLORS.navy },
  brandSub: { fontSize: 7, color: COLORS.slate, marginTop: 1 },
  docTitleWrap: { alignItems: "flex-end" },
  docTitle: { fontSize: 12, fontFamily: "Helvetica-Bold", color: COLORS.navy },
  docMeta: { fontSize: 7.5, color: COLORS.slate, marginTop: 2 },
  footer: { position: "absolute", bottom: 20, left: PAGE_PADDING, right: PAGE_PADDING, flexDirection: "row", justifyContent: "space-between", fontSize: 7, color: COLORS.slate, borderTopWidth: 1, borderTopColor: COLORS.line, paddingTop: 6 },
});

// Shared branded A4 page shell (logo + name header, deep-teal accent rule,
// footer with generation timestamp + page number) used by all three PDF
// documents so they read as one consistent, branded set.
export function PdfShell({ title, meta, children }) {
  const logo = getLogoDataUri();
  const generated = new Date().toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          <View style={styles.brandRow}>
            <Image src={logo} style={styles.logo} />
            <View>
              <Text style={styles.brandName}>Evergreen Plus Water</Text>
              <Text style={styles.brandSub}>Ever Green Water — Digital HQ</Text>
            </View>
          </View>
          <View style={styles.docTitleWrap}>
            <Text style={styles.docTitle}>{title}</Text>
            {meta ? <Text style={styles.docMeta}>{meta}</Text> : null}
          </View>
        </View>

        {children}

        <View style={styles.footer} fixed>
          <Text>{`Generated ${generated}`}</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
