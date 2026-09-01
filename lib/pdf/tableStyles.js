import { StyleSheet } from "@react-pdf/renderer";
import { COLORS } from "./theme";

export const table = StyleSheet.create({
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 10, fontFamily: "Helvetica-Bold", color: COLORS.navy, marginBottom: 6 },
  statsRow: { flexDirection: "row", marginBottom: 16 },
  statBox: { flex: 1, backgroundColor: COLORS.foam, borderRadius: 6, padding: 8, marginRight: 8 },
  statBoxLast: { flex: 1, backgroundColor: COLORS.foam, borderRadius: 6, padding: 8 },
  statLabel: { fontSize: 6.5, fontFamily: "Helvetica-Bold", color: COLORS.slate, letterSpacing: 0.5 },
  statValue: { fontSize: 12, fontFamily: "Helvetica-Bold", color: COLORS.navy, marginTop: 3 },
  head: { flexDirection: "row", backgroundColor: COLORS.navy, borderRadius: 3 },
  headCell: { fontSize: 7.5, fontFamily: "Helvetica-Bold", color: "#FFFFFF", padding: 6, textTransform: "uppercase" },
  row: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: COLORS.line },
  rowAlt: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: COLORS.line, backgroundColor: COLORS.foam },
  cell: { fontSize: 8, padding: 6, color: COLORS.ink },
  cellMuted: { fontSize: 8, padding: 6, color: COLORS.slate },
  cellBold: { fontSize: 8, padding: 6, color: COLORS.ink, fontFamily: "Helvetica-Bold" },
  empty: { fontSize: 8.5, color: COLORS.slate, padding: 12, textAlign: "center" },
});

export function statTone(tone) {
  return { coral: COLORS.coral, green: COLORS.green, amber: COLORS.amber, navy: COLORS.navy, aqua: COLORS.aqua }[tone] || COLORS.navy;
}
