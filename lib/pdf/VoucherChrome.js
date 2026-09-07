import { View, Text, StyleSheet } from "@react-pdf/renderer";
import { COLORS } from "./theme";
import { amountInWords } from "./numberToWords";

const styles = StyleSheet.create({
  infoBox: { flexDirection: "row", flexWrap: "wrap", backgroundColor: COLORS.foam, borderRadius: 8, padding: 12, marginBottom: 16 },
  infoItem: { width: "50%", marginBottom: 8 },
  infoLabel: { fontSize: 7, fontFamily: "Helvetica-Bold", color: COLORS.slate, letterSpacing: 0.4, textTransform: "uppercase" },
  infoValue: { fontSize: 9.5, color: COLORS.ink, marginTop: 2 },
  wordsBox: { borderTopWidth: 1, borderTopColor: COLORS.line, borderBottomWidth: 1, borderBottomColor: COLORS.line, paddingVertical: 8, marginTop: 4, marginBottom: 20 },
  wordsLabel: { fontSize: 7, fontFamily: "Helvetica-Bold", color: COLORS.slate, letterSpacing: 0.4, textTransform: "uppercase" },
  wordsValue: { fontSize: 9.5, fontFamily: "Helvetica-Bold", color: COLORS.navy, marginTop: 2 },
  sigRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 46 },
  sigItem: { width: "30%", alignItems: "center" },
  sigLine: { borderTopWidth: 1, borderTopColor: COLORS.ink, width: "100%", marginBottom: 4 },
  sigLabel: { fontSize: 8, color: COLORS.slate },
});

// Key/value grid for a voucher's header block — Voucher #, Date, Ref #,
// Party, etc. `items` is [{ label, value }], rendered two per row.
export function VoucherInfo({ items }) {
  return (
    <View style={styles.infoBox}>
      {items.filter(Boolean).map(({ label, value }) => (
        <View key={label} style={styles.infoItem}>
          <Text style={styles.infoLabel}>{label}</Text>
          <Text style={styles.infoValue}>{value ?? "—"}</Text>
        </View>
      ))}
    </View>
  );
}

export function VoucherAmountInWords({ amount, currency = "PKR" }) {
  return (
    <View style={styles.wordsBox}>
      <Text style={styles.wordsLabel}>Amount in words</Text>
      <Text style={styles.wordsValue}>{amountInWords(amount, currency)}</Text>
    </View>
  );
}

// Blank signature lines — the printed page is signed by hand, same idea as
// the reference voucher layout this was modeled on.
export function VoucherSignatures({ labels = ["Prepared By", "Checked By", "Approved By"] }) {
  return (
    <View style={styles.sigRow}>
      {labels.map((label) => (
        <View key={label} style={styles.sigItem}>
          <View style={styles.sigLine} />
          <Text style={styles.sigLabel}>{label}</Text>
        </View>
      ))}
    </View>
  );
}
